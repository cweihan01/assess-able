from google import genai
from google.genai import types
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont
from PIL import ImageColor

from io import BytesIO

client = genai.Client(api_key="AIzaSyAZfG6fjytN1EimpmyVhi6XgS_3slgkVJA")

# Model
MODEL_ID = "gemini-2.5-pro-preview-03-25"

# Create a path object
p = Path("images") / "caleb.jpg"

# Load and resize image
img = Image.open(p)
img = img.resize((800, int(800 * img.size[1] / img.size[0])), Image.Resampling.LANCZOS) # Resizing to speed-up rendering


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

prompt = "Analyze the bathroom layout, identifying key fixtures: toilet, shower/bathtub, sink, walls. " \
"Determine the most crucial locations where an elderly person would benefit from grab bar support for safety, stability, and transitions (sitting, standing, stepping in/out). " \
"Prioritize locations adjacent to the toilet and within/immediately outside the bathing area (shower/tub). " \
"Consider typical heights and orientations (horizontal, vertical, angled) for these bars. Assume bars must be mounted on solid wall structures. " \
"Do not suggest locations on glass, unsupported areas, or where they would obstruct movement or door operation. Do not suggest floors or ceilings. " \
"Generate an output image that is identical to the input image, but with added bounding boxes. " \
"These boxes should clearly demarcate the suggested areas for grab bar installation. Do not insert the handle bars yet."

# Load and resize image
im = Image.open(BytesIO(open(p, "rb").read()))
im.thumbnail([1024,1024], Image.Resampling.LANCZOS)

# Run model to find bounding boxes
response = client.models.generate_content(
    model=MODEL_ID,
    contents=[prompt, im],
    config = types.GenerateContentConfig(
        system_instruction=bounding_box_system_instructions,
        temperature=0.5,
        safety_settings=safety_settings,
    )
)

# Check output
print(response.text)


# @title Parsing JSON output
def parse_json(json_output: str):
    # Parsing out the markdown fencing
    lines = json_output.splitlines()
    for i, line in enumerate(lines):
        if line == "```json":
            json_output = "\n".join(lines[i+1:])  # Remove everything before "```json"
            json_output = json_output.split("```")[0]  # Remove everything after the closing "```"
            break  # Exit the loop once "```json" is found
    return json_output

additional_colors = [colorname for (colorname, colorcode) in ImageColor.colormap.items()]

def plot_bounding_boxes(im, bounding_boxes):
    """
    Plots bounding boxes on an image with markers for each a name, using PIL, normalized coordinates, and different colors.

    Args:
        img_path: The path to the image file.
        bounding_boxes: A list of bounding boxes containing the name of the object
         and their positions in normalized [y1 x1 y2 x2] format.
    """

    # Load the image
    img = im
    width, height = img.size
    print(img.size)
    # Create a drawing object
    draw = ImageDraw.Draw(img)

    # Define a list of colors
    colors = [
    'red',
    'green',
    'blue',
    'yellow',
    'orange',
    'pink',
    'purple',
    'brown',
    'gray',
    'beige',
    'turquoise',
    'cyan',
    'magenta',
    'lime',
    'navy',
    'maroon',
    'teal',
    'olive',
    'coral',
    'lavender',
    'violet',
    'gold',
    'silver',
    ] + additional_colors

    # Parsing out the markdown fencing
    bounding_boxes = parse_json(bounding_boxes)

    font = ImageFont.load_default()

    # Iterate over the bounding boxes
    for i, bounding_box in enumerate(json.loads(bounding_boxes)):
      # Select a color from the list
      color = colors[i % len(colors)]

      # Convert normalized coordinates to absolute coordinates
      abs_y1 = int(bounding_box["box_2d"][0]/1000 * height)
      abs_x1 = int(bounding_box["box_2d"][1]/1000 * width)
      abs_y2 = int(bounding_box["box_2d"][2]/1000 * height)
      abs_x2 = int(bounding_box["box_2d"][3]/1000 * width)

      if abs_x1 > abs_x2:
        abs_x1, abs_x2 = abs_x2, abs_x1

      if abs_y1 > abs_y2:
        abs_y1, abs_y2 = abs_y2, abs_y1

      # Draw the bounding box
      draw.rectangle(
          ((abs_x1, abs_y1), (abs_x2, abs_y2)), outline=color, width=4
      )

      # Draw the text
      if "label" in bounding_box:
        draw.text((abs_x1 + 8, abs_y1 + 6), bounding_box["label"], fill=color, font=font)

    # Display the image
    img.show()


plot_bounding_boxes(im, response.text)
im