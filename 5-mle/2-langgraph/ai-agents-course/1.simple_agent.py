"""
This file shows a very small "agent" pattern:
1) Keep a conversation history
2) Ask the LLM for a reply
3) If the reply asks to run an action, run that action and send the result back
"""

import os
import builtins
from dotenv import load_dotenv
from openai import OpenAI, APIConnectionError
import re

load_dotenv()

openai_key = os.getenv("OPENAI_API_KEY")
if not openai_key:
    raise RuntimeError("OPENAI_API_KEY is missing. Set it in .env or environment variables.")

llm_name = "gpt-4o-mini"
DEBUG = True


def log(*args, **kwargs):
    if DEBUG:
        builtins.print("[DEBUG]", *args, **kwargs)


def _prompt_or_default(prompt: str, default: str = "") -> str:
    """Return user input, or a default when stdin is not available."""
    try:
        return input(prompt).strip()
    except EOFError:
        if default != "":
            log(f"{prompt}{default}")
        return default

client = OpenAI(api_key=openai_key)



class Agent:
    def __init__(self, system=""):
        self.system = system
        self.messages = []
        if system:
            self.messages.append({"role": "system", "content": system})

    def __call__(self, message):
        log(f"Agent called, User message: {message}")
        self.messages.append({"role": "user", "content": message})
        result = self.execute()
        self.messages.append({"role": "assistant", "content": result})
        return result

    def execute(self):
        response = client.chat.completions.create(
            model=llm_name,
            temperature=0.0,
            messages=self.messages,
        )
        log("ㄴLLM call end ", f"response content length: {len(response.choices[0].message.content)} [END]")
        return response.choices[0].message.content


prompt = """
You run in a loop of Thought, Action, PAUSE, Observation.
At the end of the loop you output an Answer.
Use Thought to describe your thoughts about the question you have been asked.
Use Action to run one of the actions available to you - then return PAUSE.
Observation will be the result of running those actions.

Your available actions are:

calculate:
e.g. calculate: 4 * 7 / 3
Runs a calculation and returns the number - uses Python so be sure to use floating point syntax if necessary

planet_mass:
e.g. planet_mass: Earth
returns the mass of a planet in the solar system

Example session:

Question: What is the combined mass of Earth and Mars?
Thought: I should find the mass of each planet using planet_mass.
Action: planet_mass: Earth
PAUSE

You will be called again with this:

Observation: Earth has a mass of 5.972 × 10^24 kg

You then output:

Answer: Earth has a mass of 5.972 × 10^24 kg

Next, call the agent again with:

Action: planet_mass: Mars
PAUSE

Observation: Mars has a mass of 0.64171 × 10^24 kg

You then output:

Answer: Mars has a mass of 0.64171 × 10^24 kg

Finally, calculate the combined mass.

Action: calculate: 5.972 + 0.64171
PAUSE

Observation: The combined mass is 6.61371 × 10^24 kg

Answer: The combined mass of Earth and Mars is 6.61371 × 10^24 kg
""".strip()


def calculate(what):
    log(f"Action calculate() input: {what}")
    result = eval(what)
    log(f"Action calculate() output: {result}")
    return result


def planet_mass(name):
    name = name.strip()
    masses = {
        "Mercury": 0.33011,
        "Venus": 4.8675,
        "Earth": 5.972,
        "Mars": 0.64171,
        "Jupiter": 1898.19,
        "Saturn": 568.34,
        "Uranus": 86.813,
        "Neptune": 102.413,
    }
    log(f"Action planet_mass() input: {name}")
    result = f"{name} has a mass of {masses[name]} × 10^24 kg"
    log(f"Action planet_mass() output: {result}")
    return result


known_actions = {"calculate": calculate, "planet_mass": planet_mass}
agent = Agent(system=prompt)
action_re = re.compile(r"^Action: (\w+): (.*)$")

def query_interactive():
    log(f"Start interactive session with model={llm_name}")
    bot = Agent(prompt)
    while True:
        max_turns_input = _prompt_or_default(
            "Enter the maximum number of turns [default: 10]: ",
            "10",
        )
        if max_turns_input == "":
            max_turns = 10
            break
        try:
            max_turns = int(max_turns_input)
            if max_turns <= 0:
                log("Please enter a positive integer.")
                continue
            break
        except ValueError:
            log("Invalid input. Please enter a number.")
    log(f"max_turns={max_turns}")
    i = 0

    while i < max_turns:
        i += 1
        log(f"Turn {i} begin")
        question = _prompt_or_default("You: ")
        if question == "":
            log("No input. Exiting interactive session.")
            break
        log(f"User input: {question}")
        try:
            # Call the agent with the user's question and get the response
            result = bot(question)
            log("🤖 Bot:", result)

            actions = [action_re.match(a) for a in result.split("\n") if action_re.match(a)]
            log(f"Action regex matches: {len(actions)}")
            if actions:
                action, action_input = actions[0].groups()
                action_input = action_input.strip()
                log(f"Parsed action={action}, arg={action_input}")
                if action not in known_actions:
                    log(f"Unknown action: {action}: {action_input}")
                    continue
                log(f" -- running {action} {action_input}")
                observation = known_actions[action](action_input)
                log(f"Observation to send: {observation}")
                next_prompt = f"Observation: {observation}"
                result = bot(next_prompt)
                log("🤖 Bot:", result)
            else:
                log("No action found. Ending turn loop.")
                break
        except APIConnectionError as exc:
            log(f"[network] OpenAI request failed while processing input: {type(exc).__name__}")
            log("         Check OPENAI_API_KEY/network configuration (DNS, proxy, firewall) and retry.")
            break

if __name__ == "__main__":
    query_interactive()
