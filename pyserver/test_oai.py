#!/usr/bin/env python

# a super quick test of OpenAI calls

from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "system",
            "content": "You are a very wise wizard"
        },
        {
            "role": "user",
            "content": "What is the meaning of life?"
        }
    ],
    temperature=0.0
)
tree = response.choices[0].message.content
usage = response.usage
print(tree)
