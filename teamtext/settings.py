################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

from fastapi import APIRouter
from pydantic import BaseModel

class SettingsModel(BaseModel):
    """Pydantic Model for Application Settings."""

    game_title: str
    starting_message: str

router = APIRouter(prefix="/settings")

class Settings:
    """Application Settings Container."""

    playing: bool = False
    game_title: str = "TeamText"
    starting_message: str = (
        "4-H is a community of young people across America who are learning "
        "leadership, citizenship, and life skills."
    )


active = Settings()

def get_settings() -> Settings:
    """Get the Application Settings."""
    return active


# URL Routes
@router.get("/")
async def get_game_parameters():
    """Get the Game Parameters."""
    return SettingsModel(
        game_title=active.game_title,
        starting_message=active.starting_message
    )

@router.post("/")
async def set_game_parameters(parameters: SettingsModel):
    """Set the Game Parameters."""
    active.game_title = parameters.game_title
    active.starting_message = parameters.starting_message
    return parameters
