# server.py
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse, Response
from google import genai
from google.genai import types
from PIL import Image, ImageDraw, ImageFont, ImageColor
import io
import base64
import json

app = FastAPI()

# Gemini Client
client = genai.Client(api_key="AIzaSyAZfG6fjytN1EimpmyVhi6XgS_3slgkVJA")
MODEL_ID = "gemini-2.5-pro-exp-03-25"

# Instructions to Gemini
bounding_box_system_instructions = """
    Return bounding boxes as a JSON array with labels. Never return masks or code fencing. Limit to 25 objects.
    If an object is present multiple times, name them according to their unique characteristic (colors, size, position, unique characteristics, etc..).
"""

safety_settings = [
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="BLOCK_ONLY_HIGH",
    ),
]

prompt = (
    "Analyze the bathroom layout, identifying key fixtures: toilet, shower/bathtub, sink, walls. "
    "Determine the most crucial locations where an elderly person would benefit from grab bar support for safety, stability, and transitions (sitting, standing, stepping in/out). "
    "Prioritize locations adjacent to the toilet and within/immediately outside the bathing area (shower/tub). "
    "Consider typical heights and orientations (horizontal, vertical, angled) for these bars. Assume bars must be mounted on solid wall structures. "
    "Do not suggest locations on glass, unsupported areas, or where they would obstruct movement or door operation. Do not suggest floors or ceilings. "
    "Generate an output image that is identical to the input image, but with added bounding boxes. "
    "These boxes should clearly demarcate the suggested areas for grab bar installation. Do not insert the handle bars yet."
)

def parse_json(json_output: str):
    lines = json_output.splitlines()
    for i, line in enumerate(lines):
        if line == "```json":
            json_output = "\n".join(lines[i + 1:])
            json_output = json_output.split("```")[0]
            break
    return json_output

@app.post("/analyze/")
async def analyze_image(file: UploadFile = File(...)):
    # Read uploaded file
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    # Resize
    image.thumbnail([1024, 1024], Image.Resampling.LANCZOS)

    # Convert to base64
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    # Call Gemini
    response = client.models.generate_content(
        model=MODEL_ID,
        contents=[
            {"inline_data": {"mime_type": "image/jpeg", "data": img_base64}},
            prompt
        ],
        config=types.GenerateContentConfig(
            system_instruction=bounding_box_system_instructions,
            temperature=0.5,
            safety_settings=safety_settings,
        )
    )

    # Parse bounding boxes
    parsed = parse_json(response.text)
    parsed_json = json.loads(parsed)

    # Draw bounding boxes
    draw = ImageDraw.Draw(image)
    width, height = image.size

    for box in parsed_json:
        y1, x1, y2, x2 = box["box_2d"]
        abs_x1 = int(x1/1000 * width)
        abs_y1 = int(y1/1000 * height)
        abs_x2 = int(x2/1000 * width)
        abs_y2 = int(y2/1000 * height)

        draw.rectangle([(abs_x1, abs_y1), (abs_x2, abs_y2)], outline="red", width=4)

    # Save modified image to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')  # <- Save as PNG
    img_byte_arr = img_byte_arr.getvalue()

    # Return image as raw bytes
    return Response(content=img_byte_arr, media_type="image/png")

# Run the server:
# uvicorn server:app --reload
