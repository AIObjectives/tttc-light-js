import wandb 
import pyserver.schema as schema
import json
from pyserver.utils import cute_print


class WanbBLogger: 
    def __init__(self,model:str, project:str) -> None:
        self._w = wandb.init(project = project,
                             config={"model": model})
        
    def step1(self, tree:dict, comments:schema.CommentList, usage):
        comment_lengths = [len(c.text) for c in comments.comments]
        num_topics = len(tree["taxonomy"])
        subtopic_bins = [len(t["subtopics"]) for t in tree["taxonomy"]]

        # in case comments are empty / for W&B Table logging
        comment_list = "none"
        if len(comments.comments) > 1:
            comment_list = "\n".join([c.text for c in comments.comments])
        comms_tree_list = [[comment_list, json.dumps(tree,indent=1)]]

        self._w.log({
            "comm_N" : len(comments.comments),
            "comm_text_len": sum(comment_lengths),
            "comm_bins" : comment_lengths,
            "num_topics" : num_topics,
            "num_subtopics" : sum(subtopic_bins),
            "subtopic_bins" : subtopic_bins,
            "rows_to_tree" : wandb.Table(data=comms_tree_list,
                                        columns = ["comments", "taxonomy"]),

            # token counts
            "u/1/N_tok": usage.total_tokens,
            "u/1/in_tok" : usage.prompt_tokens,
            "u/1/out_tok": usage.completion_tokens
        })

    def step2(self,comms_to_claims_html, TK_2_TOT, TK_2_IN, TK_2_OUT):
       
        self._w.log({
            "u/2/N_tok" : TK_2_TOT,
            "u/2/in_tok": TK_2_IN,
            "u/2/out_tok" : TK_2_OUT,
            "rows_to_claims" : wandb.Table(
                                data=comms_to_claims_html,
                                columns = ["comments", "claims"])
            })
        
    def step3(self, full_sort_tree, dupe_logs, TK_TOT, TK_IN, TK_OUT):
        report_data = [[json.dumps(full_sort_tree, indent=2)]]
        self._w.log({
        "u/4/N_tok" : TK_TOT,
        "u/4/in_tok": TK_IN,
        "u/4/out_tok" : TK_OUT,
        "dedup_subclaims" : wandb.Table(data=dupe_logs, columns = ["sub_claim_list", "deduped_claims"]),
        "t3c_report" : wandb.Table(data=report_data, columns = ["t3c_report"])
        # TODO: do we need this?
        #"num_claims" : NUM_CLAIMS,
        #"num_topics_post_sort" : NUM_TOPICS_STEP_3
        })
       