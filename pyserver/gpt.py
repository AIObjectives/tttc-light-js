from openai import OpenAI
from abc import ABC, abstractmethod
import json
from fastapi import HTTPException
import pyserver.schema as schema
from typing import Type, TypeVar, Tuple, List
from pyserver.prompt import Prompt
import asyncio
from functools import reduce

#------------------------------------------------------------------------------
# Notes:
# In the future we should make a factory pattern or something so we can easily create a chatgpt, claude, etc client.
#------------------------------------------------------------------------------


T = TypeVar('T')

def identity(x:T)->T:
    return x


class _LLMCaller(ABC):
    '''
    Abstract class for any llm client-like class that implements 'call'
    '''
    @abstractmethod
    async def call(self,system_prompt:Prompt, full_prompt:Prompt, return_model:Type[T], preparse_transform = identity) -> Tuple[T, schema.Usage]:
        pass

class _LLMClient(_LLMCaller, ABC):
    '''
    Abstract class for anything that is an api client to an llm. OpenAI, Anthropic, etc.
    '''
    def __init__(self, model:str) -> None:
        super().__init__()
        self._client = None
        self._model = model


class ChatGPTClient(_LLMClient):
    def __init__(self, model: str) -> None:
        super().__init__(model)
        self._client = OpenAI()
        self._model = model
    
    async def call(self, system_prompt: Prompt, full_prompt: Prompt, return_model:Type[T], preparse_transform = identity) -> Tuple[T, schema.Usage]:
        try:
            response = self._client.chat.completions.create(
                model=self._model,
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
            payload = preparse_transform(json.loads(response.choices[0].message.content))
            # TODO: parse usage with schema.Usage. Don't know why it wasn't working.
            usage = response.usage
            return return_model(**payload), usage
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ChatGPT client failed to return expected response: {e}")

class BatchLLMCall(_LLMCaller):
    def __init__(self, client:_LLMClient) -> None:
        self._client = client
        self.model = client._model

    async def call(self, system_prompt: Prompt, full_prompts:List[Prompt], return_model:Type[T], preparse_transform = identity) -> Tuple[List[T], schema.Usage]:
        '''
        Matchs a batch of api calls to the llm client. 
        TODO: Probably needs more work than this to be robust in any way.
        '''
        try:
            # Build out the batch of api calls that we want to make
            tasks = [self._client.call(system_prompt=system_prompt, full_prompt=fp, return_model=return_model, preparse_transform=preparse_transform) for fp in full_prompts]
            # asyncio handles concurrency. Returns List([return_mode, usage])
            results = await asyncio.gather(*tasks)

            # reduce all the usages into a single instance
            usage = self._flatten_usages(*[r[1] for r in results])
            # extract data from results
            data = [r[0] for r in results]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"ChatGPT batch client failed: {e}")

        return data, usage
    
    def _flatten_usages(self, *args:schema.Usage) -> schema.Usage:
        add_usage = lambda a, b: schema.Usage(prompt_tokens=a.prompt_tokens + b.prompt_tokens, completion_tokens=a.completion_tokens + b.completion_tokens, total_tokens=a.total_tokens + b.total_tokens)

        return reduce(add_usage, args)

    
