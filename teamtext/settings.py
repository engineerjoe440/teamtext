################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

class Settings:
    """Application Settings Container."""

    game_title: str = "TeamText"


active = Settings()

def get_settings() -> Settings:
    """Get the Application Settings."""
    return active
