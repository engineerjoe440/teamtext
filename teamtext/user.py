################################################################################
"""
TeamText - Modern reimagining of the classic telephone game for education!

(c) 2025 Stanley Solutions
"""
################################################################################

from uuid import uuid4

class User:
    """Class representing a user in TeamText."""

    def __init__(self):
        self.user_id = str(uuid4())
