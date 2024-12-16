import pyserver.schema as schema
from typing import Dict, List
from itertools import chain

class Tree:
    def __init__(self, gist:schema.DataGist, subtopic_claims:Dict[str, List[schema.Claim]]) -> None:
        # topicName -> Gist_Topic
        self.gist = gist
        # subtopicName -> Gist_Subtopic
        self.subtopics_map = {getattr(subtopic, 'subtopicName'): subtopic for subtopic in chain(*[topic.subtopics for topic in gist.taxonomy])}
        # subtopicName -> Claims
        self.subtopic_claims = subtopic_claims

    def _sort_claims(self, subtopicName:str) -> List[schema.Claim]:
        unsorted_claims = self.subtopic_claims.get(subtopicName)
        if (unsorted_claims == None): raise Exception("Invalid subtopicName for subtopic_claims")
        return sorted(unsorted_claims, key=lambda c: len(c.duplicates), reverse=True)
    
    def _make_subtopic(self, gist_subtopic:schema.Gist_Subtopic) -> schema.Subtopic:
        return schema.Subtopic( **gist_subtopic.model_dump(), claims=self._sort_claims(gist_subtopic.subtopicName))
    
    def _sort_subtopics(self, gist_subtopics:List[schema.Gist_Subtopic])-> List[schema.Subtopic]:
        return sorted([self._make_subtopic(g_subtopic) for g_subtopic in gist_subtopics], key=lambda s: len(s.claims), reverse=True)
    
    def _make_topic(self, gist_topic:schema.Gist_Topic)->schema.Topic:
        topic_data = gist_topic.model_dump(exclude={'subtopics'})
        return schema.Topic( **topic_data, subtopics=self._sort_subtopics(gist_topic.subtopics))

    def sort(self):
        return sorted([self._make_topic(topic) for topic in self.gist.taxonomy], key=lambda topic: len(topic.subtopics), reverse=True)

    
    
