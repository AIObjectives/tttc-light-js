from pydantic import BaseModel, RootModel
from typing import List, Union, TypeVar, Generic

class Subtopic(BaseModel):
  subtopicName:str
  subtopicShortDescription:str

class Topic(BaseModel):
    topicName:str
    topicShortDescription:str
    subtopics: List[Subtopic]

class Tree(BaseModel):
  taxonomy: List[Topic]

class Claim(BaseModel):
  claim:str
  quote:str
  topicName:str
  subtopicName:str

class ClaimsList(BaseModel):
  claims: List[Claim]

class Comment(BaseModel):
  text: str

# ! Weird that this is an object with a list of comments rather than just a list. Foot-gunny
class CommentList(BaseModel):
  comments: List[Comment]

class CommentTopicTree(BaseModel):
  tree: dict
  comments: List[Comment]

class ClaimTree(BaseModel):
  tree: dict 



# allow client to override model & all prompts
class ClientLLMConfig(BaseModel):
  model: str
  system_prompt: str
  comment_to_tree_prompt: str
  comment_to_claims_prompt: str
  claim_dedup_prompt: str 

class Usage(BaseModel):
    prompt_tokens: int
    completion_tokens: int 
    total_tokens: int

#------------------------------------------------------------------------------
# Report Steps
#------------------------------------------------------------------------------

class ReportStep1(BaseModel):
  tree: dict


#------------------------------------------------------------------------------
# API Types
#------------------------------------------------------------------------------

T = TypeVar('T')

class APIResponse(BaseModel, Generic[T]):
  data: T
  usage: Usage

comments_to_tree_response = APIResponse[ReportStep1]