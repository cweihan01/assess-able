from config import GEMINI_API_KEY
from fastapi import FastAPI, UploadFile, File, Response, Form, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from google import genai
from google.genai import types
from PIL import Image, ImageDraw
import io
from io import BytesIO
import base64
import json
import os
import zipfile
from typing import List
import logging
logger = logging.getLogger('uvicorn.error')
logger.setLevel(logging.DEBUG)


app = FastAPI()

# Gemini Client
client = genai.Client(api_key=GEMINI_API_KEY)
MODEL_ID = "gemini-2.5-pro-exp-03-25"
MODEL_ID_IMG_GEN = "gemini-2.0-flash-exp-image-generation"

bounding_box_system_instructions = """
    Return bounding boxes as a JSON array with labels.
"""

safety_settings = [
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="BLOCK_ONLY_HIGH",
    ),
]


def parse_json(json_output: str):
    lines = json_output.splitlines()
    for i, line in enumerate(lines):
        if line == "```json":
            json_output = "\n".join(lines[i + 1:])
            json_output = json_output.split("```")[0]
            break
    return json_output


@app.get("/analyze/")
async def do_nothing():
    return {"error": "GET not defined for analyze/, use POST method"}


@app.post("/analyze_real/")
# @app.post("/analyze/")
async def analyze_image(
    file: UploadFile = File(...),
    # descriptions: List[str] = Form(...)
):

    # Read uploaded image and resize
    print("Starting /analyze")
    contents = await file.read()
    original_image = Image.open(io.BytesIO(contents))
    original_image.thumbnail([1024, 1024], Image.Resampling.LANCZOS)

    # Prepare base64 image for Gemini
    buffered = io.BytesIO()
    original_image.save(buffered, format="JPEG")
    img_base64 = base64.b64encode(buffered.getvalue()).decode()

    prompt_recs = (f"""
    Role: You are an occupational therapist / interior designer specialized in accessible home design, guided by ADA principles adapted for residential settings.
    Context: The resident of this home is an elderly individual experiencing significant challenges with physical mobility (e.g., difficulty walking steadily, potentially uses a cane, walker, or wheelchair) and has significant balance issues, increasing their risk of falls.
    Task: Analyze the provided images of the house interior. Based on Americans with Disabilities Act (ADA) guidelines and best practices for aging-in-place, fall prevention, and universal design, identify potential hazards and suggest specific, actionable modifications to improve safety, accessibility, and ease of use for this resident.
    Analyze these aspects within the image and provide suggestions:
    Toilet Area:
        Analyze: Current toilet height (estimate standard vs. comfort height), clear floor space surrounding it (for transfers from walker/wheelchair), presence and placement of any existing grab bars, accessibility of toilet paper holder.
        Suggest: Installing a taller "comfort height" toilet or raised seat, ensuring adequate clear transfer space, installing appropriately placed grab bars (specify locations like rear wall, side wall – consider types like straight, L-shaped), relocating toilet paper holder for easier reach.
    Sink & Vanity Area:
        Analyze: Sink/counter height, clear knee space underneath (for potential seated use), faucet control type (knobs, single lever, etc.), mirror height and visibility (standing/seated), reachability of soap/towels, general counter clutter.
        Suggest: Modifying vanity for knee space, installing lever-handle or touchless faucets (easier operation), lowering/tilting mirror, ensuring essential items are within easy reach without leaning/stretching, organizing storage.
    Bathing Area (Shower and/or Tub):
        Analyze: Method of entry (step-over tub wall, shower curb height), presence and location of grab bars, availability and type of seating (built-in/portable), shower controls (reachability from seated/standing, ease of use, anti-scald features?), shower head type (fixed/handheld, adjustable height?), slip resistance of the floor surface inside.
        Suggest: Creating a curbless/zero-entry shower, installing a tub cut-out or transfer bench for tub access, adding strategically placed grab bars (vertical at entry, horizontal/angled inside), installing a secure fold-down or fixed shower seat, ensuring easy-to-operate controls with clear temperature markings, installing a handheld shower head on an adjustable slide bar, applying non-slip treatments or ensuring high-traction surfaces.
    Flooring:
        Analyze: Main bathroom floor material type, perceived slip resistance (especially when potentially wet), presence and type of any mats or rugs (potential trip hazards).
        Suggest: Installing high-traction, non-slip flooring (e.g., matte finish tiles with appropriate COF rating, textured vinyl), removing loose rugs entirely, or using only securely adhered, low-profile, non-slip mats if absolutely necessary. Emphasize non-slip surfaces throughout.
    Output Format: Please provide multiple suggestions as a clear, prioritized list. Store each suggestion as a separate JSON object (maximum 5). For each suggestion:
    Clearly state the recommended modification, specific enough for an architect to know where on the image they should draw the changes. (Modification)
    Explain why it's important for someone with mobility/balance issues, referencing ADA principles or fall prevention where applicable. (Rationale)               
    """)

    print("Parsed image, calling Gemini")
    # Call Gemini
    response_recs = client.models.generate_content(
        model=MODEL_ID,
        contents=[
            {"inline_data": {"mime_type": "image/jpeg", "data": img_base64}},
            prompt_recs
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            safety_settings=safety_settings
        )
    )
    print("Called Gemini")

    # Parse json file
    print("response_recs.text:", response_recs.text)
    parsed_recs = parse_json(response_recs.text)
    print("parsed_recs:", parsed_recs)
    parsed_json_recs = json.loads(parsed_recs)

    with open("recommendations.json", "w", encoding="utf-8") as f:
        json.dump(parsed_json_recs, f, ensure_ascii=False, indent=4)

    print("Parsed bboxes, creating zip file")
    # 1) Create the zip BUFFER and ZIP FILE one time
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:

        # Loop over all json objects
        for rec_idx, rec in enumerate(parsed_json_recs):
            mod = parsed_json_recs[rec_idx]['Modification']
            rationale = parsed_json_recs[rec_idx]['Rationale']

            prompt_bb = (f"""
            Role: Act as an OT/Interior Designer specializing in accessible home modifications for seniors with significant mobility/balance issues and fall risk, using adapted ADA principles.
            Task: Edit the input image(s) to realistically WHERE the accessibility modifications defined in the Modification JSON object should be placed
            Output Requirements: coordinates for 1 bounding box
            "Modification": {mod}
            """)

            # Call Gemini
            response_bb = client.models.generate_content(
                model=MODEL_ID,
                contents=[
                    {"inline_data": {"mime_type": "image/jpeg", "data": img_base64}},
                    prompt_bb
                ],
                config=types.GenerateContentConfig(
                    system_instruction=bounding_box_system_instructions,
                    temperature=0,
                    safety_settings=safety_settings
                )
            )

            # Parse bounding boxes
            parsed_bb = parse_json(response_bb.text)
            parsed_json_bb = json.loads(parsed_bb)

            width, height = original_image.size

            if parsed_json_bb:

                box = parsed_json_bb[0]
                y1, x1, y2, x2 = box["box_2d"]

                # Copy image
                img_copy = original_image.copy()
                draw = ImageDraw.Draw(img_copy)

                y1, x1, y2, x2 = box["box_2d"]
                abs_x1 = int(x1 / 1000 * width)
                abs_y1 = int(y1 / 1000 * height)
                abs_x2 = int(x2 / 1000 * width)
                abs_y2 = int(y2 / 1000 * height)

                draw.rectangle([(abs_x1, abs_y1), (abs_x2, abs_y2)],
                               outline="green", width=4)

                # Save this image to bytes
                img_bytes = io.BytesIO()
                img_copy.save(img_bytes, format='PNG')
                img_bytes.seek(0)

                # Write image into the zip file
                zip_file.writestr(f"bb_image_{rec_idx + 1}.png", img_bytes.read())

                # Write rationale into the zip file
                zip_file.writestr(f"rationale_{rec_idx+1}.txt", rationale)
                zip_file.writestr(f"modification_{rec_idx+1}.txt", mod)

                # ----- Second Gemini Call for handlebar -----
                print("Calling Gemini again")

                # Prepare second prompt
                prompt_mod = f"""
                Role: Act as an OT/Interior Designer specializing in accessible home modifications for seniors with significant mobility/balance issues and fall risk, using adapted ADA principles.
                Task: Edit the input image to realistically visualize the accessibility modifications defined in the Modification JSON object.
                Output Requirements:
                Generate photorealistic edited image.
                Modifications must be seamlessly integrated (lighting, perspective).
                Accurately reflect JSON specifications (type, location, details).
                Ensure visualized changes are contextually appropriate for accessibility needs.

                "Modification": {mod}
                """

                # Save the original (without red box) for second call
                clean_img_buffer = io.BytesIO()
                original_image.save(clean_img_buffer, format="JPEG")
                clean_base64 = base64.b64encode(clean_img_buffer.getvalue()).decode()

                response_mod = client.models.generate_content(
                    model=MODEL_ID_IMG_GEN,
                    contents=[
                        {"inline_data": {"mime_type": "image/jpeg", "data": clean_base64}},
                        prompt_mod
                    ],
                    config=types.GenerateContentConfig(
                        temperature=0,
                        response_modalities=['TEXT', 'IMAGE'],
                        safety_settings=safety_settings,
                    )
                )

            # Parse the response to get the generated image
                for part in response_mod.candidates[0].content.parts:
                    if part.inline_data is not None:
                        handlebar_img = Image.open(BytesIO(part.inline_data.data))

                        # Save the handlebar image into bytes
                        img_handlebar_bytes = io.BytesIO()
                        handlebar_img.save(img_handlebar_bytes, format="PNG")
                        img_handlebar_bytes.seek(0)

                        # Add to zip
                        zip_file.writestr(
                            f"mod_image_{rec_idx+1}.png", img_handlebar_bytes.read())

    # Move the buffer to the beginning
    zip_buffer.seek(0)

    print("Saving zip file locally")
    # Save zip to local directory as well
    local_path = os.path.join(os.getcwd(), 'results_bounding_boxes.zip')
    with open(local_path, 'wb') as f:
        f.write(zip_buffer.getvalue())
    print(f"Saved zip locally to {local_path}")

    print("Done creating zip file, returning response")
    # Return the zip file as a response
    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/x-zip-compressed",
        headers={
            "Content-Disposition": "attachment; filename=bounding_boxes.zip"
        }
    )


@app.post("/analyze/")
async def analyze_image_test(file: UploadFile = File(...),):
    print("analyze_image_test called")
    zip_path = os.path.join(os.getcwd(), "sample.zip")
    if not os.path.exists(zip_path):
        raise HTTPException(404, "Test ZIP not found")

    print("returning file response with local ")
    return FileResponse(
        path=zip_path,
        media_type="application/zip",
        filename="sample.zip",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)


# uvicorn server:app --reload
