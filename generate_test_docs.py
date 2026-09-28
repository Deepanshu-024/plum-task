"""
Generate all 24 test document images for the Plum claims processing pipeline.
Uses Pillow to draw realistic Indian medical documents based on exact test case data.
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
import cv2
import numpy as np

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "public", "test_docs")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Try to use a monospace font for forms, and a handwriting font for fill-ins
try:
    FONT = ImageFont.truetype("consola.ttf", 16)
    FONT_BOLD = ImageFont.truetype("consolab.ttf", 16)
    FONT_HEADER = ImageFont.truetype("consolab.ttf", 20)
    FONT_SMALL = ImageFont.truetype("consola.ttf", 13)
except:
    FONT = ImageFont.load_default()
    FONT_BOLD = FONT
    FONT_HEADER = FONT
    FONT_SMALL = FONT

try:
    # Use built-in Windows handwriting font
    FONT_HW = ImageFont.truetype("C:\\Windows\\Fonts\\segoepr.ttf", 18)
    FONT_HW_SMALL = ImageFont.truetype("C:\\Windows\\Fonts\\segoepr.ttf", 15)
except:
    FONT_HW = FONT
    FONT_HW_SMALL = FONT_SMALL

W, H = 800, 1100
BG = (255, 255, 252)
BLACK = (30, 30, 30)
BLUE = (20, 20, 150)
GRAY = (120, 120, 120)
LINE_COLOR = (180, 180, 180)

def new_doc():
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    return img, draw

def hline(draw, y):
    draw.line([(40, y), (W - 40, y)], fill=LINE_COLOR, width=1)

def add_stamp(img, text, position=(400, 800), angle=25, color=(200, 50, 50, 180)):
    # Draw a rotated rubber stamp
    txt_img = Image.new('RGBA', (300, 100), (255, 255, 255, 0))
    d = ImageDraw.Draw(txt_img)
    d.rectangle([(10, 10), (290, 90)], outline=color, width=4)
    
    try:
        stamp_font = ImageFont.truetype("arialbd.ttf", 36)
    except:
        stamp_font = FONT_HEADER
        
    d.text((50, 25), text, fill=color, font=stamp_font)
    txt_img = txt_img.rotate(angle, expand=1)
    img.paste(txt_img, position, txt_img)
    return img

def apply_shadows(img):
    # Simulate a phone shadow falling across the document
    shadow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    
    # Draw a dark polygon across a corner/side to mimic a hand/phone shadow
    draw.polygon([(400, 0), (W, 0), (W, H), (100, H)], fill=(0, 0, 0, 80))
    draw.polygon([(0, H-300), (400, H), (0, H)], fill=(0, 0, 0, 50))
    
    # Blur the shadow heavily so it's a soft gradient
    shadow_np = np.array(shadow)
    shadow_np = cv2.GaussianBlur(shadow_np, (201, 201), 100)
    shadow = Image.fromarray(shadow_np)
    
    # Composite shadow and reduce overall contrast
    img = img.convert("RGBA")
    img = Image.alpha_composite(img, shadow)
    img = img.convert("RGB")
    
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(0.7)  # Low contrast
    return img

def apply_skew(img):
    # Simulate a slightly skewed phone photo using OpenCV perspective warp
    arr = np.array(img)
    rows, cols, ch = arr.shape
    
    # Mild skew points
    pts1 = np.float32([[0, 0], [cols, 0], [0, rows], [cols, rows]])
    pts2 = np.float32([[10, 20], [cols-15, 5], [5, rows-10], [cols-25, rows-20]])
    
    M = cv2.getPerspectiveTransform(pts1, pts2)
    dst = cv2.warpPerspective(arr, M, (cols, rows), borderValue=(220, 220, 220))
    return Image.fromarray(dst)

def save(img, filename, blur=False, skew=False, shadows=False, as_pdf=False, extra_pages=None):
    if shadows:
        img = apply_shadows(img)
    if skew:
        img = apply_skew(img)
        
    path = os.path.join(OUTPUT_DIR, filename)
    
    if blur:
        arr = np.array(img)
        arr = cv2.GaussianBlur(arr, (31, 31), 15)
        arr = cv2.GaussianBlur(arr, (31, 31), 15)  # Double blur
        img = Image.fromarray(arr)
        
    if as_pdf:
        # Convert all to RGB for PDF
        img = img.convert('RGB')
        pages = []
        if extra_pages:
            for p in extra_pages:
                pages.append(p.convert('RGB'))
        img.save(path, "PDF", resolution=100.0, save_all=True, append_images=pages)
    else:
        img.save(path, "JPEG", quality=85)
        
    print(f"  OK {filename}")


def draw_prescription(draw, doctor, reg, clinic, patient, age, gender, date, diagnosis, complaint, medicines, investigations=None, tests_ordered=None, treatment=None, handwritten=True):
    y = 40
    draw.text((50, y), doctor, fill=BLACK, font=FONT_HEADER); y += 28
    draw.text((50, y), f"Reg. No: {reg}", fill=GRAY, font=FONT_SMALL); y += 20
    draw.text((50, y), clinic, fill=GRAY, font=FONT_SMALL); y += 30
    hline(draw, y); y += 15
    
    fill_font = FONT_HW if handwritten else FONT
    fill_small = FONT_HW_SMALL if handwritten else FONT_SMALL
    fill_color = BLUE if handwritten else BLACK

    draw.text((50, y), "Patient: ", fill=BLACK, font=FONT)
    draw.text((120, y-5), patient, fill=fill_color, font=fill_font)
    draw.text((500, y), "Date: ", fill=BLACK, font=FONT)
    draw.text((550, y-5), date, fill=fill_color, font=fill_font); y += 25

    draw.text((50, y), f"Age: {age} years   Gender: {gender}", fill=GRAY, font=FONT_SMALL); y += 25
    if complaint:
        draw.text((50, y), "Chief Complaint: ", fill=BLACK, font=FONT_SMALL)
        draw.text((160, y-2), complaint, fill=fill_color, font=fill_small); y += 25
    hline(draw, y); y += 15
    
    draw.text((50, y), "Diagnosis: ", fill=BLACK, font=FONT_BOLD)
    draw.text((150, y-5), diagnosis, fill=fill_color, font=fill_font); y += 35
    
    if treatment:
        draw.text((50, y), "Treatment: ", fill=BLACK, font=FONT)
        draw.text((150, y-5), treatment, fill=fill_color, font=fill_font); y += 30
        
    draw.text((50, y), "Rx:", fill=BLACK, font=FONT_BOLD); y += 30
    for i, med in enumerate(medicines, 1):
        draw.text((70, y-5), f"{i}. {med}", fill=fill_color, font=fill_font); y += 30
    y += 10
    
    if investigations:
        draw.text((50, y), "Investigations: ", fill=BLACK, font=FONT)
        draw.text((180, y-5), investigations, fill=fill_color, font=fill_font); y += 30
    if tests_ordered:
        draw.text((50, y), "Tests Ordered: ", fill=BLACK, font=FONT)
        draw.text((170, y-5), ', '.join(tests_ordered), fill=fill_color, font=fill_font); y += 30
    y += 40
    
    draw.text((500, y), "[Doctor's Signature]", fill=GRAY, font=FONT_SMALL); y += 18
    draw.text((500, y), "[Registration Stamp]", fill=GRAY, font=FONT_SMALL)


def draw_hospital_bill(draw, hospital, address, patient, age_gender, date, line_items, total, bill_no="", referring_doctor=""):
    y = 40
    draw.text((50, y), hospital.upper(), fill=BLACK, font=FONT_HEADER); y += 28
    if address:
        draw.text((50, y), address, fill=GRAY, font=FONT_SMALL); y += 25
    hline(draw, y); y += 10
    draw.text((50, y), "BILL / RECEIPT", fill=BLACK, font=FONT_BOLD); y += 22
    if bill_no:
        draw.text((50, y), f"Bill No: {bill_no}", fill=GRAY, font=FONT_SMALL)
    draw.text((450, y), f"Date: {date}", fill=BLACK, font=FONT); y += 25
    hline(draw, y); y += 10
    draw.text((50, y), f"Patient Name: {patient}", fill=BLACK, font=FONT); y += 22
    if age_gender:
        draw.text((50, y), f"Age/Gender: {age_gender}", fill=GRAY, font=FONT_SMALL); y += 22
    if referring_doctor:
        draw.text((50, y), f"Referring Doctor: {referring_doctor}", fill=GRAY, font=FONT_SMALL); y += 22
    hline(draw, y); y += 15

    # Table header
    draw.text((50, y), "DESCRIPTION", fill=BLACK, font=FONT_BOLD)
    draw.text((500, y), "QTY", fill=BLACK, font=FONT_BOLD)
    draw.text((560, y), "RATE", fill=BLACK, font=FONT_BOLD)
    draw.text((650, y), "AMOUNT", fill=BLACK, font=FONT_BOLD); y += 25
    hline(draw, y); y += 10

    for item in line_items:
        desc = item["description"]
        amt = item["amount"]
        draw.text((50, y), desc, fill=BLACK, font=FONT)
        draw.text((500, y), "1", fill=GRAY, font=FONT)
        draw.text((560, y), f"{amt:.2f}", fill=GRAY, font=FONT)
        draw.text((650, y), f"{amt:.2f}", fill=BLACK, font=FONT); y += 22

    y += 10
    hline(draw, y); y += 10
    draw.text((500, y), "Total Amount:", fill=BLACK, font=FONT_BOLD)
    draw.text((650, y), f"{total:.2f}", fill=BLACK, font=FONT_BOLD); y += 30
    hline(draw, y); y += 10
    draw.text((50, y), "Payment Mode: Cash / UPI / Card", fill=GRAY, font=FONT_SMALL)


def draw_pharmacy_bill(draw, pharmacy, license_no, patient, doctor, date, items, net_amount, bill_no=""):
    y = 40
    draw.text((50, y), pharmacy.upper(), fill=BLACK, font=FONT_HEADER); y += 28
    draw.text((50, y), f"Drug Lic. No: {license_no}", fill=GRAY, font=FONT_SMALL); y += 25
    hline(draw, y); y += 10
    if bill_no:
        draw.text((50, y), f"Bill No: {bill_no}", fill=GRAY, font=FONT_SMALL)
    draw.text((450, y), f"Date: {date}", fill=BLACK, font=FONT); y += 22
    draw.text((50, y), f"Patient: {patient}    Dr: {doctor}", fill=BLACK, font=FONT); y += 25
    hline(draw, y); y += 10

    draw.text((50, y), "MEDICINE", fill=BLACK, font=FONT_BOLD)
    draw.text((350, y), "BATCH", fill=BLACK, font=FONT_BOLD)
    draw.text((440, y), "EXP", fill=BLACK, font=FONT_BOLD)
    draw.text((520, y), "QTY", fill=BLACK, font=FONT_BOLD)
    draw.text((580, y), "MRP", fill=BLACK, font=FONT_BOLD)
    draw.text((660, y), "AMT", fill=BLACK, font=FONT_BOLD); y += 25
    hline(draw, y); y += 10

    for item in items:
        draw.text((50, y), item["name"], fill=BLACK, font=FONT)
        draw.text((350, y), item.get("batch", ""), fill=GRAY, font=FONT_SMALL)
        draw.text((440, y), item.get("exp", ""), fill=GRAY, font=FONT_SMALL)
        draw.text((520, y), str(item.get("qty", "")), fill=GRAY, font=FONT)
        draw.text((580, y), f'{item.get("mrp", 0):.2f}', fill=GRAY, font=FONT)
        draw.text((660, y), f'{item.get("amt", 0):.2f}', fill=BLACK, font=FONT); y += 22

    y += 10
    hline(draw, y); y += 10
    draw.text((560, y), "Net Amount:", fill=BLACK, font=FONT_BOLD)
    draw.text((660, y), f"{net_amount:.2f}", fill=BLACK, font=FONT_BOLD)


def draw_lab_report(draw, lab, patient, ref_doctor, sample_date, report_date, test_name, findings):
    y = 40
    draw.text((50, y), lab.upper(), fill=BLACK, font=FONT_HEADER); y += 28
    draw.text((50, y), "NABL Accredited Lab  |  Lab ID: KA-NABL-1234", fill=GRAY, font=FONT_SMALL); y += 25
    hline(draw, y); y += 10
    draw.text((50, y), f"Patient: {patient}", fill=BLACK, font=FONT); y += 22
    draw.text((50, y), f"Ref Doctor: {ref_doctor}", fill=GRAY, font=FONT_SMALL); y += 22
    draw.text((50, y), f"Sample Date: {sample_date}   Report Date: {report_date}", fill=GRAY, font=FONT_SMALL); y += 25
    hline(draw, y); y += 15
    draw.text((50, y), f"TEST: {test_name}", fill=BLACK, font=FONT_BOLD); y += 28
    draw.text((50, y), "FINDINGS:", fill=BLACK, font=FONT_BOLD); y += 22
    for line in findings:
        draw.text((50, y), line, fill=BLACK, font=FONT); y += 22
    y += 30
    draw.text((50, y), "Dr. S. Pillai, MD (Radiology)", fill=GRAY, font=FONT_SMALL); y += 18
    draw.text((50, y), "[Signature & Stamp]", fill=GRAY, font=FONT_SMALL)


# ─────────────────────────────────────
# TC001 — Wrong Document Uploaded
# ─────────────────────────────────────
print("TC001 — Wrong Document Uploaded")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Arun Sharma, MBBS, MD (Internal Medicine)",
    reg="KA/45678/2015",
    clinic="City Medical Centre, 12 MG Road, Bengaluru",
    patient="Rajesh Kumar", age=39, gender="M", date="01-Nov-2024",
    diagnosis="Viral Fever",
    complaint="Fever since 3 days, body ache",
    medicines=["Tab Paracetamol 650mg — 1-1-1 x 5 days", "Tab Vitamin C 500mg — 0-0-1 x 7 days"],
    investigations="CBC, Dengue NS1"
)
save(img, "F001_prescription_dr_sharma.jpg")

img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Meena Pillai, MBBS, MD (General Medicine)",
    reg="KA/78901/2018",
    clinic="LifeCare Clinic, HSR Layout, Bengaluru",
    patient="Rajesh Kumar", age=39, gender="M", date="01-Nov-2024",
    diagnosis="Acute Upper Respiratory Infection",
    complaint="Cough and cold since 2 days",
    medicines=["Tab Azithromycin 500mg — 1-0-0 x 3 days", "Syp Benadryl Cough — 5ml TDS x 5 days"]
)
save(img, "F002_another_prescription.jpg", skew=True)

# ─────────────────────────────────────
# TC002 — Unreadable Document
# ─────────────────────────────────────
print("TC002 — Unreadable Document")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Ramesh Iyer, MBBS, MD (General Medicine)",
    reg="KA/56789/2016",
    clinic="MedPlus Clinic, Koramangala, Bengaluru",
    patient="Sneha Reddy", age=32, gender="F", date="25-Oct-2024",
    diagnosis="Acute Gastroenteritis",
    complaint="Loose motions and stomach cramps",
    medicines=["Tab Norfloxacin 400mg — 1-0-1 x 5 days", "Cap Racecadotril 100mg — 1-1-1 x 3 days", "ORS Powder — as needed"]
)
save(img, "F003_prescription_sneha.jpg")

img, draw = new_doc()
draw_pharmacy_bill(draw,
    pharmacy="Health First Pharmacy",
    license_no="KA-BLR-2847",
    patient="Sneha Reddy", doctor="Dr. Ramesh Iyer", date="25-Oct-2024",
    bill_no="HFP-24-10421",
    items=[
        {"name": "Norfloxacin 400mg", "batch": "A2341", "exp": "03/26", "qty": 10, "mrp": 8.00, "amt": 80.00},
        {"name": "Racecadotril 100mg", "batch": "C7821", "exp": "06/26", "qty": 9, "mrp": 12.00, "amt": 108.00},
        {"name": "ORS Powder", "batch": "D1234", "exp": "12/25", "qty": 5, "mrp": 5.00, "amt": 25.00},
    ],
    net_amount=213.00
)
save(img, "F004_blurry_pharmacy_bill.jpg", blur=True)

# ─────────────────────────────────────
# TC003 — Different Patient Names
# ─────────────────────────────────────
print("TC003 — Different Patient Names")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Arun Sharma, MBBS, MD (Internal Medicine)",
    reg="KA/45678/2015",
    clinic="City Medical Centre, Bengaluru",
    patient="Rajesh Kumar", age=39, gender="M", date="01-Nov-2024",
    diagnosis="Viral Fever",
    complaint="Fever since 3 days",
    medicines=["Tab Paracetamol 650mg — 1-1-1 x 5 days"]
)
save(img, "F005_prescription_rajesh.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="City Medical Centre",
    address="12 MG Road, Bengaluru – 560001",
    patient="Arjun Mehta", age_gender="35 / Male", date="01-Nov-2024",
    bill_no="CMC/2024/08400",
    line_items=[
        {"description": "Consultation Fee (OPD)", "amount": 1000},
        {"description": "CBC Test", "amount": 300},
        {"description": "Dengue NS1 Test", "amount": 200},
    ],
    total=1500
)
save(img, "F006_bill_arjun.jpg")

# ─────────────────────────────────────
# TC004 — Clean Consultation (Happy Path)
# ─────────────────────────────────────
print("TC004 — Clean Consultation")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Arun Sharma, MBBS, MD (Internal Medicine)",
    reg="KA/45678/2015",
    clinic="City Medical Centre, 12 MG Road, Bengaluru",
    patient="Rajesh Kumar", age=39, gender="M", date="01-Nov-2024",
    diagnosis="Viral Fever",
    complaint="Fever since 3 days, body ache",
    medicines=["Tab Paracetamol 650mg — 1-1-1 x 5 days", "Tab Vitamin C 500mg — 0-0-1 x 7 days"],
    investigations="CBC, Dengue NS1"
)
save(img, "F007_prescription_rajesh_clean.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="City Clinic, Bengaluru",
    address="12 MG Road, Bengaluru – 560001",
    patient="Rajesh Kumar", age_gender="39 / Male", date="01-Nov-2024",
    bill_no="CMC/2024/08321",
    referring_doctor="Dr. Arun Sharma",
    line_items=[
        {"description": "Consultation Fee (OPD)", "amount": 1000},
        {"description": "CBC (Complete Blood Count)", "amount": 300},
        {"description": "Dengue NS1 Antigen Test", "amount": 200},
    ],
    total=1500
)
img = add_stamp(img, "PAID IN FULL", position=(450, 750), angle=-15, color=(30, 150, 30, 180))
save(img, "F008_bill_rajesh_clean.jpg")

# ─────────────────────────────────────
# TC005 — Waiting Period (Diabetes)
# ─────────────────────────────────────
print("TC005 — Waiting Period")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Sunil Mehta, MBBS, MD (Endocrinology)",
    reg="GJ/56789/2014",
    clinic="Apollo Clinic, Ahmedabad",
    patient="Vikram Joshi", age=45, gender="M", date="15-Oct-2024",
    diagnosis="Type 2 Diabetes Mellitus",
    complaint="Increased thirst and frequent urination",
    medicines=["Tab Metformin 500mg — 1-0-1 x 30 days", "Tab Glimepiride 1mg — 1-0-0 x 30 days"]
)
save(img, "F009_prescription_vikram_diabetes.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="Apollo Clinic",
    address="SG Highway, Ahmedabad – 380015",
    patient="Vikram Joshi", age_gender="45 / Male", date="15-Oct-2024",
    bill_no="AC/2024/05621",
    line_items=[
        {"description": "Consultation Fee (Endocrinology)", "amount": 1500},
        {"description": "HbA1c Test", "amount": 800},
        {"description": "Fasting Blood Sugar", "amount": 200},
        {"description": "Medicines", "amount": 500},
    ],
    total=3000
)
save(img, "F010_bill_vikram_diabetes.jpg")

# ─────────────────────────────────────
# TC006 — Dental Partial Approval (Multi-page PDF test)
# ─────────────────────────────────────
print("TC006 — Dental Partial (PDF)")
img_page1, draw1 = new_doc()
draw_hospital_bill(draw1,
    hospital="Smile Dental Clinic",
    address="Bandra West, Mumbai – 400050",
    patient="Priya Singh", age_gender="34 / Female", date="15-Oct-2024",
    bill_no="SDC/2024/01234",
    line_items=[
        {"description": "Root Canal Treatment", "amount": 8000},
    ],
    total=8000
)

# Page 2: Continued line items
img_page2, draw2 = new_doc()
draw_hospital_bill(draw2,
    hospital="Smile Dental Clinic (Page 2)",
    address="Bandra West, Mumbai – 400050",
    patient="Priya Singh", age_gender="34 / Female", date="15-Oct-2024",
    bill_no="SDC/2024/01234",
    line_items=[
        {"description": "Teeth Whitening", "amount": 4000},
    ],
    total=12000
)
img_page2 = add_stamp(img_page2, "DUPLICATE", position=(300, 600), angle=45)

save(img_page1, "F011_bill_priya_dental.pdf", as_pdf=True, extra_pages=[img_page2])

# ─────────────────────────────────────
# TC007 — MRI Without Pre-Auth
# ─────────────────────────────────────
print("TC007 — MRI Without Pre-Auth")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. Venkat Rao, MBBS, MS (Orthopaedics)",
    reg="AP/67890/2017",
    clinic="Manipal Hospital, Hyderabad",
    patient="Suresh Patil", age=49, gender="M", date="02-Nov-2024",
    diagnosis="Suspected Lumbar Disc Herniation",
    complaint="Lower back pain radiating to left leg",
    medicines=["Tab Aceclofenac 100mg — 1-0-1 x 5 days"],
    tests_ordered=["MRI Lumbar Spine"]
)
save(img, "F012_prescription_suresh_mri.jpg")

img, draw = new_doc()
draw_lab_report(draw,
    lab="Precision Diagnostics Pvt Ltd",
    patient="Suresh Patil",
    ref_doctor="Dr. Venkat Rao",
    sample_date="02-Nov-2024", report_date="02-Nov-2024",
    test_name="MRI Lumbar Spine",
    findings=[
        "L4-L5 disc bulge with mild thecal sac compression.",
        "No significant nerve root compression noted.",
        "Mild degenerative changes at L3-L4 and L4-L5.",
        "No evidence of spinal canal stenosis.",
    ]
)
save(img, "F013_lab_report_mri.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="Precision Diagnostics Pvt Ltd",
    address="45 Jayanagar, Bengaluru – 560041",
    patient="Suresh Patil", age_gender="49 / Male", date="02-Nov-2024",
    bill_no="PD/2024/18723",
    line_items=[
        {"description": "MRI Lumbar Spine", "amount": 15000},
    ],
    total=15000
)
save(img, "F014_bill_suresh_mri.jpg")

# ─────────────────────────────────────
# TC008 — Per-Claim Limit Exceeded
# ─────────────────────────────────────
print("TC008 — Per-Claim Limit Exceeded")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. R. Gupta, MBBS, MD (General Medicine)",
    reg="DL/34567/2016",
    clinic="Max Healthcare, Saket, New Delhi",
    patient="Amit Verma", age=36, gender="M", date="20-Oct-2024",
    diagnosis="Gastroenteritis",
    complaint="Severe stomach pain and vomiting",
    medicines=["Tab Ofloxacin 200mg — 1-0-1 x 5 days", "Cap Probiotics — 1-1-1 x 7 days", "ORS Powder — as needed"]
)
save(img, "F015_prescription_amit.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="Max Healthcare",
    address="Saket, New Delhi – 110017",
    patient="Amit Verma", age_gender="36 / Male", date="20-Oct-2024",
    bill_no="MAX/2024/34521",
    line_items=[
        {"description": "Consultation Fee", "amount": 2000},
        {"description": "Medicines", "amount": 5500},
    ],
    total=7500
)
save(img, "F016_bill_amit.jpg")

# ─────────────────────────────────────
# TC009 — Fraud Signal
# ─────────────────────────────────────
print("TC009 — Fraud Signal")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. S. Khan, MBBS, MD (Neurology)",
    reg="KA/34567/2017",
    clinic="City Clinic D, Bengaluru",
    patient="Ravi Menon", age=37, gender="M", date="30-Oct-2024",
    diagnosis="Migraine",
    complaint="Severe throbbing headache, photophobia",
    medicines=["Tab Sumatriptan 50mg — SOS", "Tab Naproxen 500mg — 1-0-1 x 3 days"]
)
save(img, "F017_prescription_ravi_migraine.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="City Clinic D",
    address="Whitefield, Bengaluru – 560066",
    patient="Ravi Menon", age_gender="37 / Male", date="30-Oct-2024",
    bill_no="CCD/2024/09821",
    line_items=[
        {"description": "Consultation Fee (Neurology)", "amount": 2000},
        {"description": "Medicines", "amount": 1800},
        {"description": "CT Scan Head (Plain)", "amount": 1000},
    ],
    total=4800
)
save(img, "F018_bill_ravi_migraine.jpg")

# ─────────────────────────────────────
# TC010 — Network Hospital Discount
# ─────────────────────────────────────
print("TC010 — Network Hospital Discount")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. S. Iyer, MBBS, MD (Pulmonology)",
    reg="TN/56789/2013",
    clinic="Apollo Hospitals, Chennai",
    patient="Deepak Shah", age=44, gender="M", date="03-Nov-2024",
    diagnosis="Acute Bronchitis",
    complaint="Persistent cough with sputum, mild fever",
    medicines=["Tab Amoxicillin 500mg — 1-1-1 x 7 days", "Salbutamol Inhaler — 2 puffs PRN"]
)
save(img, "F019_prescription_deepak.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="Apollo Hospitals",
    address="Greams Road, Chennai – 600006",
    patient="Deepak Shah", age_gender="44 / Male", date="03-Nov-2024",
    bill_no="APL/2024/78321",
    referring_doctor="Dr. S. Iyer",
    line_items=[
        {"description": "Consultation Fee", "amount": 1500},
        {"description": "Medicines", "amount": 3000},
    ],
    total=4500
)
img = add_stamp(img, "APOLLO - CASH PAID", position=(400, 750), angle=20)
save(img, "F020_bill_deepak_apollo.jpg")

# ─────────────────────────────────────
# TC011 — Component Failure
# ─────────────────────────────────────
print("TC011 — Component Failure")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Vaidya T. Krishnan, BAMS (Ayurveda)",
    reg="AYUR/KL/2345/2019",
    clinic="Ayur Wellness Centre, Kochi",
    patient="Kavita Nair", age=41, gender="F", date="28-Oct-2024",
    diagnosis="Chronic Joint Pain",
    complaint="Pain in both knees for 6 months",
    medicines=["Maharasnadi Kashayam — 15ml BD", "Kottamchukkadi Thailam — external application"],
    treatment="Panchakarma Therapy"
)
save(img, "F021_prescription_kavita_ayur.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="Ayur Wellness Centre",
    address="MG Road, Kochi – 682016",
    patient="Kavita Nair", age_gender="41 / Female", date="28-Oct-2024",
    bill_no="AWC/2024/02341",
    line_items=[
        {"description": "Panchakarma Therapy (5 sessions)", "amount": 3000},
        {"description": "Consultation", "amount": 1000},
    ],
    total=4000
)
save(img, "F022_bill_kavita_ayur.jpg")

# ─────────────────────────────────────
# TC012 — Excluded Treatment
# ─────────────────────────────────────
print("TC012 — Excluded Treatment")
img, draw = new_doc()
draw_prescription(draw,
    doctor="Dr. P. Banerjee, MBBS, MS (General Surgery)",
    reg="WB/34567/2015",
    clinic="Fortis Hospital, Kolkata",
    patient="Anita Desai", age=31, gender="F", date="18-Oct-2024",
    diagnosis="Morbid Obesity — BMI 37",
    complaint="Weight management consultation",
    medicines=["Orlistat 120mg — 1-1-1 x 30 days"],
    treatment="Bariatric Consultation and Customised Diet Plan"
)
save(img, "F023_prescription_anita_obesity.jpg")

img, draw = new_doc()
draw_hospital_bill(draw,
    hospital="Fortis Hospital",
    address="Salt Lake, Kolkata – 700091",
    patient="Anita Desai", age_gender="31 / Female", date="18-Oct-2024",
    bill_no="FH/2024/56789",
    line_items=[
        {"description": "Bariatric Consultation", "amount": 3000},
        {"description": "Personalised Diet and Nutrition Program", "amount": 5000},
    ],
    total=8000
)
save(img, "F024_bill_anita_obesity.jpg", shadows=True)


print(f"\nDONE - All 24 documents generated in: {OUTPUT_DIR}")
