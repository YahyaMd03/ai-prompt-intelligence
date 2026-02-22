from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Platform(str, Enum):
    YOUTUBE = "youtube"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    GENERIC = "generic"


class Size(str, Enum):
    LANDSCAPE = "landscape"
    VERTICAL = "vertical"
    SQUARE = "square"


class Category(str, Enum):
    KIDS = "kids"
    EDUCATION = "education"
    MARKETING = "marketing"
    STORYTELLING = "storytelling"
    GENERIC = "generic"


class RunStatus(str, Enum):
    CREATED = "created"
    EXTRACTED = "extracted"
    ENHANCED = "enhanced"
    SCRIPT_GENERATED = "script_generated"
    FAILED = "failed"


@dataclass
class PromptOptions:
    duration_seconds: Optional[int] = None
    language: Optional[str] = None
    platform: Optional[Platform] = None
    size: Optional[Size] = None
    category: Optional[Category] = None
