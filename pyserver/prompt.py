import json
from pydantic import BaseModel

class Prompt:
    def __init__(self, *args) -> None:
        # Convert each argument to string, handling Pydantic models specially
        self.value = ''.join(
            f"{self._serialize_arg(arg)}\n" for arg in args
        )    
    def _serialize_arg(self, arg):
        # If it's a string, return as is
        if isinstance(arg, str):
            return arg
        # If it's a Pydantic model, convert to dict first
        if isinstance(arg, BaseModel):
            return json.dumps(arg.model_dump())
        # Otherwise, try to JSON serialize directly
        return json.dumps(arg)
    
    def __repr__(self) -> str:
        return f"Prompt: {self.value}"