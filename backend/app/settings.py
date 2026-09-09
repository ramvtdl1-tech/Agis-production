from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    otp_minutes: int = 5
    otp_max_attempts: int = 5
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = "agis@example.gov"
    resend_api_key: str = ""
    resend_from: str = "onboarding@resend.dev"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from_number: str = ""
    openai_api_key: str = ""
    agis_bootstrap_approval_token: str = ""
    openai_model: str = "openrouter/free"
    openai_base_url: str = "https://openrouter.ai/api/v1"
    s3_endpoint: str = ""
    s3_bucket: str = "agis-documents"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_region: str = "us-east-1"
    cors_origins: str = "http://localhost:5173"
    upload_max_mb: int = 25
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    @property
    def cors_list(self): return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
settings = Settings()
twilio_account_sid: str = ""
twilio_auth_token: str = ""
twilio_from_number: str = ""