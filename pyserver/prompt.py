import json

class Prompt:
    def __init__(self, *args) -> None:
        # Jsonify args that are not str, concat everything together.
        self.value = ''.join(f"{json.dumps(arg) if not isinstance(arg, str) else arg}\n" for arg in args)
        print(self.value)

    