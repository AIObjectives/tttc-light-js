#! /usr/bin env python
import json
import wandb

def cute_print(json_obj):
  """Returns a pretty version of a dictionary as properly-indented and scaled
  json in html for at-a-glance review in W&B"""
  str_json = json.dumps(json_obj, indent=1)
  cute_html = '<pre id="json"><font size=2>' + str_json + "</font></pre>"
  return wandb.Html(cute_html)
