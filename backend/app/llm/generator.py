import json
import re
import uuid
from typing import Literal, Any
from groq import AsyncGroq
import google.generativeai as genai
import google.ai.generativelanguage as glm

from app.config import settings
from app.llm.tools import execute_tool

def convert_openai_to_gemini_tools(available_tools: list[dict[str, Any]]) -> list[Any] | None:
    """
    Converts OpenAI-style tool schema list to Gemini SDK-compatible FunctionDeclaration objects.
    """
    if not available_tools:
        return None

    from google.generativeai import types

    def convert_schema_types(schema: Any) -> Any:
        if not isinstance(schema, dict):
            return schema
        new_schema = {}
        for k, v in schema.items():
            if k == "type" and isinstance(v, str):
                new_schema[k] = v.upper() # 'string' -> 'STRING', 'object' -> 'OBJECT', etc.
            elif isinstance(v, dict):
                new_schema[k] = convert_schema_types(v)
            elif isinstance(v, list):
                new_schema[k] = [convert_schema_types(item) if isinstance(item, dict) else item for item in v]
            else:
                new_schema[k] = v
        return new_schema

    declarations = []
    for tool_item in available_tools:
        if tool_item.get("type") != "function":
            continue
        func = tool_item["function"]
        name = func["name"]
        description = func.get("description", "")
        params = func.get("parameters", {})
        converted_params = convert_schema_types(params)

        decl = types.FunctionDeclaration(
            name=name,
            description=description,
            parameters=converted_params
        )
        declarations.append(decl)

    return declarations if declarations else None

async def generate_trajectory(
    prompt: str,
    available_tools: list[dict[str, Any]],
    provider: Literal["groq", "gemini"]
) -> list[dict[str, Any]]:
    """
    Generates an agent run trajectory for a prompt and a tool schema.
    Returns an ordered list of steps (tool_call, tool_result, final_response).
    """
    if provider == "groq":
        if not settings.GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY environment variable is not set.")
        return await _generate_groq_trajectory(prompt, available_tools)
    elif provider == "gemini":
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set.")
        return await _generate_gemini_trajectory(prompt, available_tools)
    else:
        raise ValueError(f"Unknown provider: {provider}")

def _extract_json_braces(text: str) -> str | None:
    start = text.find('{')
    if start == -1:
        return None
    brace_count = 0
    for i in range(start, len(text)):
        char = text[i]
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0:
                return text[start:i+1]
    return None

def _parse_failed_generation(failed_str: str) -> tuple[str, dict[str, Any]] | None:
    if not failed_str:
        return None
    match = re.search(r"<function=(\w+)", failed_str)
    if not match:
        return None
    func_name = match.group(1)
    json_block = _extract_json_braces(failed_str)
    if not json_block:
        return None
    try:
        args = json.loads(json_block)
        return func_name, args
    except Exception:
        return None

async def _generate_groq_trajectory(prompt: str, available_tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    model = settings.GROQ_MODEL
    
    # Setup messages
    messages = [{"role": "user", "content": prompt}]
    trajectory = []
    
    # Map from Groq format tools
    groq_tools = available_tools if available_tools else None
    
    step_count = 0
    while step_count < settings.AGENT_MAX_STEPS:
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                tools=groq_tools,
                tool_choice="auto" if groq_tools else None,
                max_completion_tokens=1024,
            )
            msg = response.choices[0].message
            messages.append(msg)
        except Exception as e:
            # Handle Groq bad request / tool_use_failed errors by parsing failed_generation
            import groq
            if isinstance(e, groq.BadRequestError):
                try:
                    err_body = e.body
                    if isinstance(err_body, dict) and "error" in err_body:
                        err_info = err_body["error"]
                        if err_info.get("code") == "tool_use_failed" and "failed_generation" in err_info:
                            failed_gen = err_info["failed_generation"]
                            parsed = _parse_failed_generation(failed_gen)
                            if parsed:
                                tool_name, tool_args = parsed
                                
                                # Record tool call in trajectory
                                trajectory.append({
                                    "type": "tool_call",
                                    "name": tool_name,
                                    "arguments": tool_args
                                })
                                
                                # Execute the mock tool
                                tool_res = execute_tool(tool_name, tool_args)
                                
                                # Record result
                                trajectory.append({
                                    "type": "tool_result",
                                    "name": tool_name,
                                    "result": tool_res
                                })
                                
                                # Simulate a valid tool call ID
                                tc_id = f"call_{uuid.uuid4().hex[:8]}"
                                
                                # Append valid simulated assistant and tool response messages to history
                                messages.append({
                                    "role": "assistant",
                                    "content": None,
                                    "tool_calls": [
                                        {
                                            "id": tc_id,
                                            "type": "function",
                                            "function": {
                                                "name": tool_name,
                                                "arguments": json.dumps(tool_args)
                                            }
                                        }
                                    ]
                                })
                                messages.append({
                                    "role": "tool",
                                    "tool_call_id": tc_id,
                                    "name": tool_name,
                                    "content": json.dumps(tool_res)
                                })
                                
                                step_count += 1
                                continue
                except Exception:
                    pass
            raise e
        
        # Check if the model called a tool
        if msg.tool_calls:
            for tc in msg.tool_calls:
                tool_name = tc.function.name
                # Parse arguments
                try:
                    tool_args = json.loads(tc.function.arguments)
                except Exception:
                    tool_args = {"raw_arguments": tc.function.arguments}
                
                # Record tool_call
                trajectory.append({
                    "type": "tool_call",
                    "name": tool_name,
                    "arguments": tool_args
                })
                
                # Execute tool
                tool_res = execute_tool(tool_name, tool_args)
                
                # Record tool_result
                trajectory.append({
                    "type": "tool_result",
                    "name": tool_name,
                    "result": tool_res
                })
                
                # Feed tool result back to Groq message history
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": tool_name,
                    "content": json.dumps(tool_res)
                })
                
                step_count += 1
                if step_count >= settings.AGENT_MAX_STEPS:
                    break
        else:
            # Model gave final response
            trajectory.append({
                "type": "final_response",
                "content": msg.content or ""
            })
            return trajectory
            
    # If we reached here, we hit the step limit without final response
    trajectory.append({
        "type": "final_response",
        "content": "[Trajectory truncated: AGENT_MAX_STEPS limit reached without final response]"
    })
    return trajectory

async def _generate_gemini_trajectory(prompt: str, available_tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    gemini_tools = convert_openai_to_gemini_tools(available_tools)
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        tools=gemini_tools
    )
    
    chat = model.start_chat()
    trajectory = []
    
    step_count = 0
    # Initial message
    response = await chat.send_message_async(prompt)
    
    while step_count < settings.AGENT_MAX_STEPS:
        # Check for function calls
        function_calls = []
        for part in response.parts:
            if part.function_call:
                function_calls.append(part.function_call)
                
        if function_calls:
            # Execute and reply to each function call
            # Note: Gemini allows returning multiple tool responses in one turn if requested
            tool_responses_parts = []
            for fc in function_calls:
                tool_name = fc.name
                tool_args = dict(fc.args)
                
                # Record tool_call
                trajectory.append({
                    "type": "tool_call",
                    "name": tool_name,
                    "arguments": tool_args
                })
                
                # Execute tool
                tool_res = execute_tool(tool_name, tool_args)
                
                # Record tool_result
                trajectory.append({
                    "type": "tool_result",
                    "name": tool_name,
                    "result": tool_res
                })
                
                # Build Gemini function response part
                tool_responses_parts.append(
                    glm.Part(
                        function_response=glm.FunctionResponse(
                            name=tool_name,
                            response=tool_res
                        )
                    )
                )
                
                step_count += 1
                if step_count >= settings.AGENT_MAX_STEPS:
                    break
            
            # Send the tool responses back to the model
            if tool_responses_parts:
                response = await chat.send_message_async(tool_responses_parts)
            else:
                break
        else:
            # Model gave final response
            trajectory.append({
                "type": "final_response",
                "content": response.text or ""
            })
            return trajectory
            
    # If we reached here, we hit step limit
    trajectory.append({
        "type": "final_response",
        "content": "[Trajectory truncated: AGENT_MAX_STEPS limit reached without final response]"
    })
    return trajectory
