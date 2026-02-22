class AppError(Exception):
    def __init__(self, message: str, code: str = "app_error"):
        super().__init__(message)
        self.code = code


class ValidationError(AppError):
    def __init__(self, message: str):
        super().__init__(message, code="validation_error")


class ProviderError(AppError):
    def __init__(self, message: str):
        super().__init__(message, code="provider_error")
