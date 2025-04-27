from fpdf import FPDF
from datetime import datetime

class PDFReport(FPDF):
    def header(self):
        # Custom header for every page except the cover
        if self.page_no() != 1:
            self.set_font('Arial', 'B', 15)
            self.cell(0, 10, 'Fall Prevention Home Safety Report', align='C')
            self.ln(10)

    def add_cover_page(self):
        self.add_page()
        self.set_font('Arial', 'B', 24)
        self.cell(0, 80, '', ln=True)  # vertical space

        self.cell(0, 20, 'Home Safety Improvement Report', align='C', ln=True)
        self.ln(10)

        self.set_font('Arial', '', 16)
        self.cell(0, 10, 'Generated using AI Recommendations', align='C', ln=True)
        self.ln(10)

        self.set_font('Arial', 'I', 12)
        today = datetime.today().strftime('%B %d, %Y')
        self.cell(0, 10, f'Date: {today}', align='C', ln=True)

        self.ln(30)
        self.set_font('Arial', '', 12)
        self.multi_cell(0, 10, 'This report contains home safety recommendations aimed at reducing fall risks for older adults. Each recommendation is supported by rationale, cost estimate, and installation notes.')

    def add_image_and_description(self, img_path, text_data):
        self.add_page()

        # Insert the image
        self.image(img_path, x=10, y=20, w=180)
        self.ln(110)  # Adjust based on image size

        # Insert the text content
        self.set_font('Arial', 'B', 14)
        self.cell(0, 10, "Recommendation Details", ln=True)
        self.ln(5)

        self.set_font('Arial', 'B', 12)
        self.multi_cell(0, 8, f"Rationale:", align="L")
        self.set_font('Arial', '', 12)
        self.multi_cell(0, 8, text_data.get('rationale', 'N/A'))
        self.ln(5)

        self.set_font('Arial', 'B', 12)
        self.multi_cell(0, 8, f"Modification:", align="L")
        self.set_font('Arial', '', 12)
        self.multi_cell(0, 8, text_data.get('modification', 'N/A'))
        self.ln(5)

        self.set_font('Arial', 'B', 12)
        self.multi_cell(0, 8, f"Cost:", align="L")
        self.set_font('Arial', '', 12)
        self.multi_cell(0, 8, text_data.get('cost', 'N/A'))
        self.ln(5)

        self.set_font('Arial', 'B', 12)
        self.multi_cell(0, 8, f"Installation:", align="L")
        self.set_font('Arial', '', 12)
        self.multi_cell(0, 8, text_data.get('installation', 'N/A'))