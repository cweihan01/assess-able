from google import genai
from google.genai import types
from pathlib import Path
import IPython
import json
import random
from PIL import Image, ImageDraw, ImageFont
from PIL import ImageColor

import io
import os
import requests
from io import BytesIO
from config import GEMINI_API_KEY

client = genai.Client(api_key=GEMINI_API_KEY)

# Model
MODEL_ID = "gemini-2.0-flash-exp-image-generation"

# Create a path object
IMG_PATH = Path("images") / "caleb.jpg"
JSON_PATH = Path("caleb.json")

# Open json
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    json_output = json.load(f)
# Read first box
selected_box = json_output[2]
print(selected_box)

# Load and resize image
img = Image.open(IMG_PATH)
im = img.resize((800, int(800 * img.size[1] / img.size[0])), Image.Resampling.LANCZOS) # Resizing to speed-up rendering

# # Load and resize image
# im = Image.open(BytesIO(open(IMG_PATH, "rb").read()))
# im.thumbnail([1024,1024], Image.Resampling.LANCZOS)

safety_settings = [
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="BLOCK_ONLY_HIGH",
    ),
]

prompt = f"""
You are given an image of a bathroom and a bounding box: {selected_box["box_2d"]}.
Inside this bounding box, draw a single grab bar suitable for elderly support, oriented horizontally or vertically depending on the shape of the box.
Do not modify anything outside of the bounding box. Keep the original image intact except for the grab bar.
Return only the modified image.
Given the input image:
   - The entirety of the generated grab bar, including any mounting hardware, must be **strictly confined within** the boundaries defined by the bounding box.
   - Ensure only one grab bar is added to the entire image.
   - Integrate this single, correctly placed and oriented grab bar realistically (matching perspective, lighting, texture of the surrounding scene).
"""



# Run model to find bounding boxes
response = client.models.generate_content(
    model=MODEL_ID,
    contents=[prompt, im],
    config = types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
        temperature=0.5,
        safety_settings=safety_settings,
    )
)

for part in response.candidates[0].content.parts:
  if part.text is not None:
    print(part.text)
  elif part.inline_data is not None:
    image = Image.open(BytesIO(part.inline_data.data))
    image.show()