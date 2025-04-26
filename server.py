from fastapi import FastAPI, UploadFile, File, Response
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
import io
from io import BytesIO
import base64
import json
import zipfile

app = FastAPI()

# Gemini Client
client = genai.Client(api_key="AIzaSyAZfG6fjytN1EimpmyVhi6XgS_3slgkVJA")
MODEL_ID = "gemini-2.5-pro-exp-03-25"
MODEL_ID_IMG_GEN = "gemini-2.0-flash-exp-image-generation"

bounding_box_system_instructions = """
    Return bounding boxes as a JSON array with labels. Never return masks or code fencing. Limit to 25 objects.
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
    original_image = Image.open(io.BytesIO(contents))
    
    # Resize
    original_image.thumbnail([1024, 1024], Image.Resampling.LANCZOS)

    # Prepare base64 image for Gemini
    buffered = io.BytesIO()
    original_image.save(buffered, format="JPEG")
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

    width, height = original_image.size

    # Create an in-memory zip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for idx, box in enumerate(parsed_json):
            # Copy image
            img_copy = original_image.copy()
            draw = ImageDraw.Draw(img_copy)

            y1, x1, y2, x2 = box["box_2d"]
            abs_x1 = int(x1 / 1000 * width)
            abs_y1 = int(y1 / 1000 * height)
            abs_x2 = int(x2 / 1000 * width)
            abs_y2 = int(y2 / 1000 * height)

            draw.rectangle([(abs_x1, abs_y1), (abs_x2, abs_y2)], outline="red", width=4)

            # Save this image to bytes
            img_bytes = io.BytesIO()
            img_copy.save(img_bytes, format='PNG')
            img_bytes.seek(0)

            # Write image into the zip file
            zip_file.writestr(f"bb_image_{idx + 1}.png", img_bytes.read())

            # ----- NOW: Second Gemini Call for handlebar -----

            # Prepare second prompt
            handlebar_prompt = f"""
            You are given an image of a bathroom and a bounding box: {box["box_2d"]}.
            Please draw a realistic safety grab bar **inside** this bounding box.
            Maintain the rest of the bathroom untouched.
            """

            # Save the original (without red box) for second call
            clean_img_buffer = io.BytesIO()
            original_image.save(clean_img_buffer, format="JPEG")
            clean_base64 = base64.b64encode(clean_img_buffer.getvalue()).decode()

            handlebar_response = client.models.generate_content(
                model=MODEL_ID_IMG_GEN,
                contents=[
                    {"inline_data": {"mime_type": "image/jpeg", "data": clean_base64}},
                    handlebar_prompt
                ],
                config=types.GenerateContentConfig(
                    temperature=0.5,
                    response_modalities=['TEXT', 'IMAGE'],
                    safety_settings=safety_settings,
                )
            )

           # Parse the response to get the generated image
            for part in handlebar_response.candidates[0].content.parts:
                if part.inline_data is not None:
                    handlebar_img = Image.open(BytesIO(part.inline_data.data))
                    
                    # Save the handlebar image into bytes
                    img_handlebar_bytes = io.BytesIO()
                    handlebar_img.save(img_handlebar_bytes, format="PNG")
                    img_handlebar_bytes.seek(0)

                    # Add to zip
                    zip_file.writestr(f"mod_image_{idx+1}.png", img_handlebar_bytes.read())

    # Move the buffer to the beginning
    zip_buffer.seek(0)

    # Return the zip file as a response
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/x-zip-compressed",
        headers={
            "Content-Disposition": "attachment; filename=bounding_boxes.zip"
        }
    )