from openai import OpenAI
from abc import ABC, abstractmethod
import json
from fastapi import HTTPException
import pyserver.schema as schema
from typing import Type, TypeVar, Tuple
from pyserver.prompt import Prompt

#------------------------------------------------------------------------------
# Notes:
# _LLMClient defines an abstract class that defines the shape of our gpt clients
# In the future we should make a factory pattern or something so we can easily create a chatgpt, claude, etc client.
#------------------------------------------------------------------------------


T = TypeVar('T')

class _LLMClient(ABC):

    def __init__(self, model:str) -> None:
        super().__init__()
        self._client = self._initClient()
        self.model = model
    @abstractmethod
    def _initClient(self):
        pass

    @abstractmethod
    def call(self,system_prompt:Prompt, full_prompt:Prompt):
        pass


class ChatGPTClient(_LLMClient):
    def __init__(self, model: str) -> None:
        super().__init__(model)
        self._client = self._initClient()
        self.model = model

    def _initClient(self):
        return OpenAI()
    
    def call(self, system_prompt: Prompt, full_prompt: Prompt, return_model:Type[T]) -> Tuple[T, schema.Usage]:
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                {
                    "role": "system",
                    "content": system_prompt.value
                },
                {
                    "role": "user",
                    "content": full_prompt.value
                }
                ],
                temperature = 0.0,
                response_format = {"type": "json_object"}
            )
        except:
            raise HTTPException(status_code=500, detail="ChatGPT client failed")
        try:
            payload = json.loads(response.choices[0].message.content)
            # TODO: parse usage with schema.Usage. Don't know why it wasn't working.
            usage = response.usage
            return return_model(**payload), usage
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ChatGPT client failed to return expected response, {e}")

