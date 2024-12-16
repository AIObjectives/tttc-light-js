from pydantic import BaseModel, RootModel
from typing import List, Union, TypeVar, Generic, Dict
from uuid import UUID

# class Subtopic(BaseModel):
#   subtopicName:str
#   subtopicShortDescription:str

# class Topic(BaseModel):
#     topicName:str
#     topicShortDescription:str
#     subtopics: List[Subtopic]

# class Tree(BaseModel):
#   taxonomy: List[Topic]




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


#------------------------------------------------------------------------------
# Pipeline Step1
#------------------------------------------------------------------------------

class Comment(BaseModel):
  text: str

class CommentList(BaseModel):
  comments: List[Comment]

class Gist_Subtopic(BaseModel):
  subtopicName:str
  subtopicShortDescription:str

class Gist_Topic(BaseModel):
    topicName:str
    topicShortDescription:str
    subtopics: List[Gist_Subtopic]


# Topics and subtopics that summarize a dataset
class DataGist(BaseModel):
  taxonomy: List[Gist_Topic]

#------------------------------------------------------------------------------
# Pipeline Step2
#------------------------------------------------------------------------------

class Extracted_Claim(BaseModel):
  claim:str
  quote:str
  topicName:str
  # commentId:str # TODO: implement this part
  subtopicName:str

class Extracted_ClaimsList(BaseModel):
  claims: List[Extracted_Claim]


#------------------------------------------------------------------------------
# Pipeline Step3
#------------------------------------------------------------------------------

# ClaimId -> Extracted Claim. Extracted claim does not have an id itself.
class Id_Extracted_Claims_Map(BaseModel):
  claimMap: Dict[str, Extracted_Claim]

# subtopicId -> Gist_Subtopic. Gist_Subtopic does not have an id on itself, but we'll add it to the obj at the very end
class Id_Gist_Subtopics_Map(BaseModel):
  subtopicMap: Dict[UUID, Gist_Subtopic]

# A subtopic's claims are wrapped into an Id_Extracted_Claims_Map
class Subtopic_Dedup_Claims(BaseModel):
  subtopicMap: Dict[UUID, Id_Extracted_Claims_Map]

# ClaimId -> list of duplicate ClaimIds
class NestingClaims(BaseModel):
  nesting: Dict[str, List[str]]


#------------------------------------------------------------------------------
# Pipeline Output
#------------------------------------------------------------------------------

class Base_Claim(BaseModel):
  claimId:str
  # commentId:str
  claim:str
  quote:str
  subtopicName:str
  topicName:str

class Claim(Base_Claim):
  duplicates: List[Base_Claim]

class Subtopic(Gist_Subtopic):
  claims: List[Claim]

class Topic(Gist_Topic):
  subtopics: List[Subtopic]
  
class Tree:
  tree: List[Topic]

#------------------------------------------------------------------------------
# API Types
#------------------------------------------------------------------------------

T = TypeVar('T')

class APIResponse(BaseModel, Generic[T]):
  data: T
  usage: Usage

# class Gist(BaseModel):
#   gist: DataGist

class Step1Data(BaseModel):
  gist: DataGist
  comments: CommentList

comments_to_tree_response = APIResponse[Step1Data]
