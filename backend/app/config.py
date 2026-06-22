import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str = Field(..., validation_alias="DATABASE_URL")
    FIREBASE_SERVICE_ACCOUNT_JSON: str | None = Field(default=None, validation_alias="FIREBASE_SERVICE_ACCOUNT_JSON")
    GROQ_API_KEY: str | None = Field(default=None, validation_alias="GROQ_API_KEY")
    GEMINI_API_KEY: str | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    GROQ_MODEL: str = Field(..., validation_alias="GROQ_MODEL")
    GEMINI_MODEL: str = Field(..., validation_alias="GEMINI_MODEL")
    AGENT_MAX_STEPS: int = Field(default=8, validation_alias="AGENT_MAX_STEPS")
    MIN_SHARED_ANNOTATIONS_FOR_KAPPA: int = Field(default=5, validation_alias="MIN_SHARED_ANNOTATIONS_FOR_KAPPA")
    FRONTEND_ORIGIN: str = Field(default="http://localhost:5173", validation_alias="FRONTEND_ORIGIN")
    MOCK_AUTH: bool = Field(default=False, validation_alias="MOCK_AUTH")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
