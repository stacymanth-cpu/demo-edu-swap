"""
Generate EduSwap Phase 1 Presentation PowerPoint
Rubric criteria covered:
  1. Relevance of Topic
  2. Clarity of Problem Statement
  3. Feasibility
  4. Originality & Innovation
  5. Potential Impact
  6. Design - User Interface (Mock-up)
  7. Project Plan and WBS, Tools/Technologies
  8. Presentation and Teamwork (slide for team roles)
"""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

# ─── Colors ────────────────────────────────────────────────────────
PRIMARY = RGBColor(0x6C, 0x3C, 0xE1)      # Purple
PRIMARY_LIGHT = RGBColor(0x8B, 0x5C, 0xF6)
SECONDARY = RGBColor(0x0E, 0xA5, 0xE9)    # Cyan
ACCENT = RGBColor(0x10, 0xB9, 0x81)        # Green
DARK = RGBColor(0x0F, 0x17, 0x2A)          # Near-black
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_GRAY = RGBColor(0xF1, 0xF5, 0xF9)
GRAY = RGBColor(0x64, 0x74, 0x8B)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)

SLIDE_WIDTH = Inches(13.333)
SLIDE_HEIGHT = Inches(7.5)

prs = Presentation()
prs.slide_width = SLIDE_WIDTH
prs.slide_height = SLIDE_HEIGHT

LOGO_PATH = os.path.join(os.path.dirname(__file__), "src", "assets", "logo.png")

# ─── Helpers ───────────────────────────────────────────────────────

def add_gradient_bg(slide, color1=DARK, color2=PRIMARY):
    """Add a dark solid background."""
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color1

def add_shape_bg(slide, left, top, width, height, color, alpha=None):
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = color
    shape.line.fill.background()
    if alpha is not None:
        shape.fill.fore_color.brightness = alpha
    return shape

def add_text_box(slide, left, top, width, height, text, font_size=18,
                 color=WHITE, bold=False, alignment=PP_ALIGN.LEFT, font_name="Calibri"):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    p = tf.paragraphs[0]
    p.text = text
    p.font.size = Pt(font_size)
    p.font.color.rgb = color
    p.font.bold = bold
    p.font.name = font_name
    p.alignment = alignment
    return txBox

def add_bullet_slide(slide, left, top, width, height, items, font_size=16,
                     color=WHITE, bullet_color=None, spacing=Pt(8)):
    txBox = slide.shapes.add_textbox(left, top, width, height)
    tf = txBox.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        if i == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = item
        p.font.size = Pt(font_size)
        p.font.color.rgb = color
        p.font.name = "Calibri"
        p.space_after = spacing
        p.level = 0
    return txBox

def add_accent_bar(slide, top, color=PRIMARY):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), top, Inches(0.08), Inches(0.5))
    bar.fill.solid()
    bar.fill.fore_color.rgb = color
    bar.line.fill.background()
    return bar

def section_header(slide, title, subtitle=None):
    add_gradient_bg(slide)
    # Accent decoration
    add_shape_bg(slide, Inches(0), Inches(0), Inches(13.333), Inches(0.06), PRIMARY)
    add_shape_bg(slide, Inches(0), Inches(7.44), Inches(13.333), Inches(0.06), PRIMARY)
    # Title
    add_text_box(slide, Inches(0.8), Inches(0.5), Inches(11), Inches(0.6),
                 title, font_size=32, color=WHITE, bold=True)
    # Underline accent
    add_shape_bg(slide, Inches(0.8), Inches(1.1), Inches(2), Inches(0.05), PRIMARY)
    if subtitle:
        add_text_box(slide, Inches(0.8), Inches(1.25), Inches(11), Inches(0.5),
                     subtitle, font_size=16, color=GRAY)

def add_logo(slide, left, top, width=Inches(1)):
    if os.path.exists(LOGO_PATH):
        slide.shapes.add_picture(LOGO_PATH, left, top, width=width)

# ═══════════════════════════════════════════════════════════════════
# SLIDE 1 — Title Slide
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank
add_gradient_bg(slide)

# Decorative elements
add_shape_bg(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.08), PRIMARY)
add_shape_bg(slide, Inches(0), Inches(7.42), SLIDE_WIDTH, Inches(0.08), PRIMARY)

# Logo
add_logo(slide, Inches(5.67), Inches(1.2), width=Inches(2))

# Title
add_text_box(slide, Inches(1), Inches(3.4), Inches(11.3), Inches(1),
             "EduSwap", font_size=56, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

# Subtitle
add_text_box(slide, Inches(1), Inches(4.3), Inches(11.3), Inches(0.6),
             "Skill Exchange Platform for University Students", font_size=24,
             color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

# Phase badge
badge = add_shape_bg(slide, Inches(5.17), Inches(5.1), Inches(3), Inches(0.5), PRIMARY)
add_text_box(slide, Inches(5.17), Inches(5.1), Inches(3), Inches(0.5),
             "Phase 1 — Presentation", font_size=16, color=WHITE, bold=True,
             alignment=PP_ALIGN.CENTER)

# Course info
add_text_box(slide, Inches(1), Inches(6.0), Inches(11.3), Inches(0.4),
             "BICT300 — Final Year Project • Computer Science (Application Development)",
             font_size=14, color=GRAY, alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(1), Inches(6.4), Inches(11.3), Inches(0.4),
             "April 2026",
             font_size=13, color=GRAY, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 2 — Table of Contents / Agenda
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Agenda", "What we'll cover today")

agenda_items = [
    "1.  Introduction & Problem Statement",
    "2.  Our Solution — EduSwap",
    "3.  Key Objectives",
    "4.  System Architecture & Technology Stack",
    "5.  Data Model Design",
    "6.  Core Features Overview",
    "7.  UI/UX Design — Mockups & Screenshots",
    "8.  Project Plan & Work Breakdown Structure",
    "9.  Team Roles & Responsibilities",
    "10. Feasibility & Innovation",
    "11. Questions & Discussion",
]
add_bullet_slide(slide, Inches(1), Inches(1.7), Inches(10), Inches(5.5),
                 agenda_items, font_size=18, color=LIGHT_GRAY, spacing=Pt(12))


# ═══════════════════════════════════════════════════════════════════
# SLIDE 3 — Problem Statement  (Rubric: Relevance + Problem Statement)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "The Problem", "Why EduSwap is needed")

problems = [
    "•  Many students cannot afford private tutoring or supplementary learning resources",
    "•  Fellow students possess valuable skills and knowledge they could share",
    "•  There is no structured platform connecting these complementary needs",
    "•  Traditional tutoring platforms charge fees — excluding financially constrained students",
    "•  Skills gaps exist across different university departments and institutions",
    "•  Students lack motivation to teach because there is no incentive system",
]
add_bullet_slide(slide, Inches(1), Inches(1.7), Inches(11), Inches(5),
                 problems, font_size=18, color=LIGHT_GRAY, spacing=Pt(14))

# Highlight box
highlight = add_shape_bg(slide, Inches(1), Inches(5.8), Inches(11.3), Inches(0.8), PRIMARY)
add_text_box(slide, Inches(1.3), Inches(5.85), Inches(10.7), Inches(0.7),
             "Key Insight: Students are both the demand AND the supply — they just need a platform to connect.",
             font_size=16, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 4 — Solution Overview
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Our Solution — EduSwap", "A peer-to-peer skill exchange platform for university students")

solutions = [
    "✓  Automatically matches users with complementary skill sets",
    "✓  Enables session scheduling with video call integration",
    "✓  Tracks learning progress through a credit-based economy",
    "✓  Facilitates real-time communication between matched users",
    "✓  Supports multiple SA universities with cross-institution matching",
    "✓  Provides community feedback through comments and ratings",
]
add_bullet_slide(slide, Inches(1), Inches(1.7), Inches(7), Inches(4.5),
                 solutions, font_size=17, color=LIGHT_GRAY, spacing=Pt(14))

# Platform badges
add_shape_bg(slide, Inches(9), Inches(2), Inches(3.5), Inches(1.2), RGBColor(0x1E, 0x1E, 0x30))
add_text_box(slide, Inches(9), Inches(2.1), Inches(3.5), Inches(0.4),
             "📱  Android App (Kotlin)", font_size=16, color=SECONDARY, bold=True,
             alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(9), Inches(2.6), Inches(3.5), Inches(0.4),
             "Jetpack Compose + Material 3", font_size=13, color=GRAY,
             alignment=PP_ALIGN.CENTER)

add_shape_bg(slide, Inches(9), Inches(3.5), Inches(3.5), Inches(1.2), RGBColor(0x1E, 0x1E, 0x30))
add_text_box(slide, Inches(9), Inches(3.6), Inches(3.5), Inches(0.4),
             "🌐  Web App (React)", font_size=16, color=ACCENT, bold=True,
             alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(9), Inches(4.1), Inches(3.5), Inches(0.4),
             "TypeScript + Vite + Firebase", font_size=13, color=GRAY,
             alignment=PP_ALIGN.CENTER)

add_shape_bg(slide, Inches(9), Inches(5), Inches(3.5), Inches(1.2), RGBColor(0x1E, 0x1E, 0x30))
add_text_box(slide, Inches(9), Inches(5.1), Inches(3.5), Inches(0.4),
             "☁️  Shared Backend", font_size=16, color=AMBER, bold=True,
             alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(9), Inches(5.6), Inches(3.5), Inches(0.4),
             "Firebase Auth + Firestore", font_size=13, color=GRAY,
             alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 5 — Key Objectives  (Rubric: Relevance)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Key Objectives", "Measurable outcomes for the project")

objectives = [
    ("Enable skill-based matching", "Algorithm matches complementary users with 90%+ relevance"),
    ("Support real-time communication", "Chat messages delivered in under 2 seconds"),
    ("Integrate virtual sessions", "Video call links launch correctly on Android and Web"),
    ("Multi-university support", "Users from different universities can discover and match"),
    ("Credit economy", "Credits earned/spent tracked accurately per session"),
]

y = Inches(1.7)
for i, (obj, measure) in enumerate(objectives):
    row_bg = add_shape_bg(slide, Inches(1), y, Inches(11.3), Inches(0.9),
                          RGBColor(0x1E, 0x1E, 0x30))
    # Number
    num_bg = add_shape_bg(slide, Inches(1), y, Inches(0.7), Inches(0.9), PRIMARY)
    add_text_box(slide, Inches(1), y + Inches(0.15), Inches(0.7), Inches(0.6),
                 str(i + 1), font_size=20, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    # Objective
    add_text_box(slide, Inches(1.9), y + Inches(0.08), Inches(4.5), Inches(0.4),
                 obj, font_size=16, color=WHITE, bold=True)
    # Measure
    add_text_box(slide, Inches(1.9), y + Inches(0.45), Inches(9), Inches(0.4),
                 measure, font_size=13, color=GRAY)
    y += Inches(1.0)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 6 — System Architecture  (Rubric: Feasibility + Technologies)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "System Architecture", "Both platforms share a single Firebase backend")

# Architecture boxes
# Android box
add_shape_bg(slide, Inches(1), Inches(2), Inches(3.5), Inches(2), RGBColor(0x1E, 0x1E, 0x30))
add_text_box(slide, Inches(1), Inches(2.1), Inches(3.5), Inches(0.5),
             "📱 Android App", font_size=18, color=SECONDARY, bold=True, alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(1.2), Inches(2.7), Inches(3.1), Inches(1.2),
             "Kotlin + Jetpack Compose\nMVVM + Clean Architecture\nHilt DI • Coroutines + Flow",
             font_size=13, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

# Web box
add_shape_bg(slide, Inches(8.8), Inches(2), Inches(3.5), Inches(2), RGBColor(0x1E, 0x1E, 0x30))
add_text_box(slide, Inches(8.8), Inches(2.1), Inches(3.5), Inches(0.5),
             "🌐 Web App", font_size=18, color=ACCENT, bold=True, alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(9), Inches(2.7), Inches(3.1), Inches(1.2),
             "React + TypeScript\nComponent Architecture\nReact Router • CSS Variables",
             font_size=13, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

# Arrow down from both
add_text_box(slide, Inches(2.3), Inches(4.1), Inches(1), Inches(0.5),
             "▼", font_size=24, color=PRIMARY, alignment=PP_ALIGN.CENTER)
add_text_box(slide, Inches(10.1), Inches(4.1), Inches(1), Inches(0.5),
             "▼", font_size=24, color=PRIMARY, alignment=PP_ALIGN.CENTER)

# Firebase box (center)
add_shape_bg(slide, Inches(3.9), Inches(4.7), Inches(5.5), Inches(2.3), PRIMARY)
add_text_box(slide, Inches(3.9), Inches(4.8), Inches(5.5), Inches(0.5),
             "☁️ Firebase Backend", font_size=20, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

firebase_services = [
    "Authentication — Email/Password sign-in",
    "Cloud Firestore — Real-time NoSQL database",
    "Cloud Storage — Profile photos & media",
    "Firebase Hosting — Web app deployment",
]
add_bullet_slide(slide, Inches(4.4), Inches(5.4), Inches(4.5), Inches(1.5),
                 firebase_services, font_size=13, color=WHITE, spacing=Pt(4))


# ═══════════════════════════════════════════════════════════════════
# SLIDE 7 — Technology Stack  (Rubric: Technologies)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Technology Stack", "Tools and frameworks used in development")

# Android column
add_shape_bg(slide, Inches(0.8), Inches(1.7), Inches(5.7), Inches(0.55), PRIMARY)
add_text_box(slide, Inches(0.8), Inches(1.75), Inches(5.7), Inches(0.5),
             "📱 Android Application", font_size=17, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

android_tech = [
    "Language:  Kotlin",
    "UI:  Jetpack Compose + Material 3",
    "Architecture:  MVVM + Clean Architecture",
    "DI:  Hilt (Dagger)",
    "Async:  Coroutines + Flow",
    "Images:  Coil",
    "Backend:  Firebase SDK",
    "Min SDK:  API 26 (Android 8.0)",
]
add_bullet_slide(slide, Inches(1), Inches(2.4), Inches(5.3), Inches(4.5),
                 android_tech, font_size=14, color=LIGHT_GRAY, spacing=Pt(8))

# Web column
add_shape_bg(slide, Inches(6.8), Inches(1.7), Inches(5.7), Inches(0.55), ACCENT)
add_text_box(slide, Inches(6.8), Inches(1.75), Inches(5.7), Inches(0.5),
             "🌐 Web Application", font_size=17, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

web_tech = [
    "Language:  TypeScript",
    "Framework:  React 18+ (Vite)",
    "Styling:  CSS Variables + Modules",
    "State:  React Context + Hooks",
    "Routing:  React Router v6",
    "Backend:  Firebase JS SDK v9+",
    "Icons:  Lucide React",
    "Dates:  date-fns",
]
add_bullet_slide(slide, Inches(7), Inches(2.4), Inches(5.3), Inches(4.5),
                 web_tech, font_size=14, color=LIGHT_GRAY, spacing=Pt(8))


# ═══════════════════════════════════════════════════════════════════
# SLIDE 8 — Data Model  (Rubric: Feasibility)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Data Model", "Cloud Firestore collections — shared by Android & Web")

collections = [
    ("users/{uid}", "User profiles, skills, credits, rating, university", "Core identity"),
    ("matches/{id}", "Match pairs with skill exchange, status tracking", "Matching system"),
    ("sessions/{id}", "Scheduled sessions with date, skill, duration", "Session mgmt"),
    ("chatRooms/{id}", "Chat rooms with participants and last message", "Real-time chat"),
    ("chatRooms/{id}/messages", "Individual messages with sender, text, timestamp", "Chat messages"),
    ("transactions/{id}", "Credit history — earned, spent, welcome bonus", "Credit system"),
    ("universities/{id}", "University names, domains, logos", "Multi-uni support"),
    ("skillsCatalog/{id}", "Skill names, categories, icons, user counts", "Skill discovery"),
]

y = Inches(1.7)
for collection, desc, purpose in collections:
    row_bg = add_shape_bg(slide, Inches(0.8), y, Inches(11.7), Inches(0.65),
                          RGBColor(0x1E, 0x1E, 0x30))
    add_text_box(slide, Inches(1), y + Inches(0.08), Inches(3.5), Inches(0.5),
                 collection, font_size=13, color=SECONDARY, bold=True)
    add_text_box(slide, Inches(4.7), y + Inches(0.08), Inches(5.5), Inches(0.5),
                 desc, font_size=13, color=LIGHT_GRAY)
    add_text_box(slide, Inches(10.3), y + Inches(0.08), Inches(2), Inches(0.5),
                 purpose, font_size=12, color=GRAY)
    y += Inches(0.72)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 9 — Core Features  (Rubric: Relevance + Innovation)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Core Features", "Key functionalities of the EduSwap platform")

features = [
    ("🔐", "Authentication", "Email/password signup, login, password reset, session persistence", PRIMARY),
    ("👤", "Profile Management", "Photo upload, skill management, bio editing, university selection", SECONDARY),
    ("🤝", "Skill Matching", "Smart algorithm matching complementary skill sets across universities", ACCENT),
    ("📅", "Session Scheduling", "Schedule sessions with date, time, duration, and video call links", AMBER),
    ("💬", "Real-time Chat", "Instant messaging with matched users via Firestore onSnapshot", PRIMARY_LIGHT),
    ("💰", "Credit System", "Earn credits by teaching, spend to learn — with transaction history", RGBColor(0xEC, 0x48, 0x99)),
]

x_start = Inches(0.6)
y_start = Inches(1.7)
card_w = Inches(3.9)
card_h = Inches(2.6)
gap = Inches(0.25)

for i, (icon, title, desc, color) in enumerate(features):
    col = i % 3
    row = i // 3
    x = x_start + col * (card_w + gap)
    y = y_start + row * (card_h + gap)

    card = add_shape_bg(slide, x, y, card_w, card_h, RGBColor(0x1E, 0x1E, 0x30))
    # Accent top bar
    add_shape_bg(slide, x, y, card_w, Inches(0.05), color)
    # Icon
    add_text_box(slide, x + Inches(0.3), y + Inches(0.2), Inches(0.6), Inches(0.5),
                 icon, font_size=28, color=WHITE)
    # Title
    add_text_box(slide, x + Inches(0.3), y + Inches(0.8), Inches(3.3), Inches(0.4),
                 title, font_size=17, color=WHITE, bold=True)
    # Desc
    add_text_box(slide, x + Inches(0.3), y + Inches(1.3), Inches(3.3), Inches(1.2),
                 desc, font_size=13, color=GRAY)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 10 — Credit System  (Rubric: Innovation)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Credit System", "How the skill exchange economy works")

credit_items = [
    ("Welcome Bonus", "+50 credits", "New users start with 50 credits to begin learning immediately", ACCENT),
    ("Complete Teaching", "+10 credits", "Teachers earn credits for each completed session", ACCENT),
    ("Book Learning", "−10 credits", "Learners spend credits to schedule a learning session", RGBColor(0xEF, 0x44, 0x44)),
    ("5-Star Review", "+5 bonus", "Teachers receive bonus credits for excellent reviews", AMBER),
]

y = Inches(1.8)
for title, amount, desc, color in credit_items:
    row_bg = add_shape_bg(slide, Inches(1), y, Inches(11.3), Inches(1.1), RGBColor(0x1E, 0x1E, 0x30))
    # Amount badge
    badge = add_shape_bg(slide, Inches(1.3), y + Inches(0.25), Inches(1.8), Inches(0.6), color)
    add_text_box(slide, Inches(1.3), y + Inches(0.25), Inches(1.8), Inches(0.6),
                 amount, font_size=18, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    # Title
    add_text_box(slide, Inches(3.5), y + Inches(0.1), Inches(4), Inches(0.5),
                 title, font_size=17, color=WHITE, bold=True)
    # Description
    add_text_box(slide, Inches(3.5), y + Inches(0.55), Inches(8), Inches(0.5),
                 desc, font_size=13, color=GRAY)
    y += Inches(1.25)

# Key insight box
add_shape_bg(slide, Inches(1), Inches(6.3), Inches(11.3), Inches(0.7), PRIMARY)
add_text_box(slide, Inches(1.3), Inches(6.35), Inches(10.7), Inches(0.6),
             "This creates a self-sustaining economy where teaching is rewarded and learning is accessible.",
             font_size=15, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 11 — Matching Algorithm  (Rubric: Innovation + Feasibility)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Matching Algorithm", "How EduSwap finds the perfect learning partners")

steps = [
    ("Step 1", "Find Potential Teachers", "Query users whose skillsTeach overlaps with the current user's skillsLearn"),
    ("Step 2", "Filter for Reciprocity", "Keep only users whose skillsLearn overlaps with the current user's skillsTeach"),
    ("Step 3", "Calculate Match Score", "Score based on: skill overlap (60%), university bonus (20%), rating (20%)"),
    ("Step 4", "Sort & Present", "Return candidates sorted by match score descending"),
]

y = Inches(1.8)
for step, title, desc in steps:
    add_shape_bg(slide, Inches(1), y, Inches(11.3), Inches(1.05), RGBColor(0x1E, 0x1E, 0x30))
    # Step badge
    add_shape_bg(slide, Inches(1), y, Inches(1.2), Inches(1.05), PRIMARY)
    add_text_box(slide, Inches(1), y + Inches(0.25), Inches(1.2), Inches(0.6),
                 step, font_size=14, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, Inches(2.5), y + Inches(0.1), Inches(9), Inches(0.4),
                 title, font_size=16, color=WHITE, bold=True)
    add_text_box(slide, Inches(2.5), y + Inches(0.55), Inches(9), Inches(0.4),
                 desc, font_size=13, color=GRAY)
    y += Inches(1.2)

# Score formula
add_shape_bg(slide, Inches(1), Inches(6.4), Inches(11.3), Inches(0.7), RGBColor(0x1E, 0x1E, 0x30))
add_text_box(slide, Inches(1.3), Inches(6.45), Inches(10.7), Inches(0.6),
             "Score = (Skill Overlap × 30) + (Reciprocal Overlap × 30) + (Same University × 20) + (Rating × 4)",
             font_size=14, color=SECONDARY, bold=True, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 12 — UI/UX Design  (Rubric: Design - User Interface)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "UI/UX Design — Web Application", "Modern dark theme with glassmorphism and micro-animations")

screens = [
    ("🏠  Landing Page", "Hero section, features grid, CTA buttons, animated gradient orbs"),
    ("🔐  Login / Sign Up", "Glassmorphism cards, floating orb backgrounds, password reset flow"),
    ("📊  Dashboard", "Stats cards, upcoming sessions, recommended matches, trending skills"),
    ("🔍  Explore", "Skills grid + users view, category filters, match request modals"),
    ("🤝  Matches", "Pending/accepted tabs, accept/decline actions, session scheduling modal"),
    ("📅  Sessions", "Filter by status, complete/cancel actions, video call integration"),
    ("💬  Chat", "Real-time messaging, room list with unread badges, online status"),
    ("👤  Profile", "Inline editing, skill suggestions, photo upload, credit history, reviews"),
]

y = Inches(1.6)
for i, (screen, desc) in enumerate(screens):
    col = i % 2
    row = i // 2
    x = Inches(0.8) + col * Inches(6.2)
    cy = Inches(1.6) + row * Inches(1.25)

    add_shape_bg(slide, x, cy, Inches(5.9), Inches(1.1), RGBColor(0x1E, 0x1E, 0x30))
    add_text_box(slide, x + Inches(0.2), cy + Inches(0.08), Inches(5.5), Inches(0.4),
                 screen, font_size=15, color=WHITE, bold=True)
    add_text_box(slide, x + Inches(0.2), cy + Inches(0.5), Inches(5.5), Inches(0.5),
                 desc, font_size=12, color=GRAY)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 13 — Application Screens  (Rubric: Design - UI Mock-up)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Application Screens", "16 screens across both Android and Web platforms")

screen_list = [
    ("🔐", "Login"), ("📝", "Sign Up"), ("🏠", "Dashboard"),
    ("🔍", "Explore Skills"), ("📋", "Skill Detail"), ("🤝", "Matches List"),
    ("👥", "Match Detail"), ("📅", "Sessions List"), ("⏰", "Schedule Session"),
    ("💬", "Chat List"), ("🗨️", "Conversation"), ("👤", "Profile"),
    ("✏️", "Edit Profile"), ("⭐", "Reviews"), ("💰", "Credit History"),
    ("🏫", "University View"),
]

x_start = Inches(0.6)
y_start = Inches(1.7)
cols = 4
box_w = Inches(2.9)
box_h = Inches(1.2)
x_gap = Inches(0.25)
y_gap = Inches(0.2)

for i, (icon, name) in enumerate(screen_list):
    col = i % cols
    row = i // cols
    x = x_start + col * (box_w + x_gap)
    y = y_start + row * (box_h + y_gap)

    add_shape_bg(slide, x, y, box_w, box_h, RGBColor(0x1E, 0x1E, 0x30))
    add_text_box(slide, x, y + Inches(0.15), box_w, Inches(0.5),
                 icon, font_size=24, color=WHITE, alignment=PP_ALIGN.CENTER)
    add_text_box(slide, x, y + Inches(0.65), box_w, Inches(0.4),
                 name, font_size=13, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 14 — Project Plan / WBS  (Rubric: Project Plan + WBS)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Project Plan — Development Phases", "Work Breakdown Structure (WBS)")

phases = [
    ("Phase 1", "Auth & Profile", "Week 1", "Firebase setup, Login/SignUp, profile creation, skills, photo upload", PRIMARY),
    ("Phase 2", "Skill Matching", "Week 2", "Matching algorithm, Explore screen, match suggestions, requests", SECONDARY),
    ("Phase 3", "Sessions & Video", "Week 2-3", "Session scheduling, video call integration, status management", ACCENT),
    ("Phase 4", "Credit System", "Week 3", "Welcome bonus, credit transfer, transaction history, balance badge", AMBER),
    ("Phase 5", "Real-time Chat", "Week 3-4", "Chat rooms, real-time messaging, image support, unread badges", PRIMARY_LIGHT),
    ("Phase 6", "Comments & Reviews", "Week 4", "Post-session reviews, star ratings, average on profiles", RGBColor(0xEC, 0x48, 0x99)),
    ("Phase 7", "Multi-University", "Week 4", "University collection, filtering, statistics, leaderboard", RGBColor(0x3B, 0x82, 0xF6)),
    ("Phase 8", "Polish & Deploy", "Week 5", "UI polish, animations, error handling, Firebase Hosting, APK", RGBColor(0xEF, 0x44, 0x44)),
]

y = Inches(1.6)
for phase, title, timeline, tasks, color in phases:
    add_shape_bg(slide, Inches(0.8), y, Inches(11.7), Inches(0.65), RGBColor(0x1E, 0x1E, 0x30))
    # Phase badge
    add_shape_bg(slide, Inches(0.8), y, Inches(1.2), Inches(0.65), color)
    add_text_box(slide, Inches(0.8), y + Inches(0.12), Inches(1.2), Inches(0.4),
                 phase, font_size=11, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    # Title
    add_text_box(slide, Inches(2.2), y + Inches(0.05), Inches(2.5), Inches(0.3),
                 title, font_size=14, color=WHITE, bold=True)
    # Timeline
    add_text_box(slide, Inches(2.2), y + Inches(0.35), Inches(2), Inches(0.3),
                 timeline, font_size=11, color=GRAY)
    # Tasks
    add_text_box(slide, Inches(5), y + Inches(0.1), Inches(7), Inches(0.5),
                 tasks, font_size=12, color=LIGHT_GRAY)
    y += Inches(0.72)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 15 — Team Roles  (Rubric: Presentation and Teamwork)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Team Roles & Responsibilities", "Work is divided evenly amongst team members")

add_text_box(slide, Inches(1), Inches(1.7), Inches(11), Inches(0.6),
             "Each team member contributed equally to research, development, testing, and presentation preparation.",
             font_size=16, color=GRAY)

# Placeholder cards — users should fill in their team member names
roles = [
    ("Team Member 1", "Frontend Web Development\nReact components, CSS styling, responsive design"),
    ("Team Member 2", "Backend & Firebase\nFirestore services, authentication, data model"),
    ("Team Member 3", "Android Development\nKotlin, Jetpack Compose, MVVM architecture"),
    ("Team Member 4", "UI/UX Design & Testing\nMockups, user testing, documentation"),
]

x_start = Inches(0.6)
card_w = Inches(2.9)
card_h = Inches(3.5)
gap = Inches(0.3)
y = Inches(2.5)

for i, (name, role) in enumerate(roles):
    x = x_start + i * (card_w + gap)
    add_shape_bg(slide, x, y, card_w, card_h, RGBColor(0x1E, 0x1E, 0x30))
    # Avatar circle
    circle = add_shape_bg(slide, x + Inches(0.95), y + Inches(0.3), Inches(1), Inches(1), PRIMARY)
    add_text_box(slide, x + Inches(0.95), y + Inches(0.55), Inches(1), Inches(0.5),
                 "👤", font_size=28, color=WHITE, alignment=PP_ALIGN.CENTER)
    # Name
    add_text_box(slide, x + Inches(0.2), y + Inches(1.5), Inches(2.5), Inches(0.4),
                 name, font_size=15, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)
    # Role
    add_text_box(slide, x + Inches(0.2), y + Inches(2.0), Inches(2.5), Inches(1.3),
                 role, font_size=12, color=GRAY, alignment=PP_ALIGN.CENTER)

# Note
add_text_box(slide, Inches(1), Inches(6.5), Inches(11), Inches(0.5),
             "💡 Replace \"Team Member\" placeholders with your actual team members' names and specific roles.",
             font_size=13, color=AMBER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 16 — Feasibility & Innovation  (Rubric: Feasibility + Innovation)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Feasibility & Innovation", "Why this project is practical and original")

# Feasibility column
add_shape_bg(slide, Inches(0.8), Inches(1.7), Inches(5.7), Inches(0.55), ACCENT)
add_text_box(slide, Inches(0.8), Inches(1.75), Inches(5.7), Inches(0.5),
             "✅  Feasibility", font_size=17, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

feasibility = [
    "•  Firebase free tier is sufficient for development and demo",
    "•  React + Kotlin are industry-standard, well-documented technologies",
    "•  Shared backend ensures data consistency across platforms",
    "•  Progressive development phases allow incremental testing",
    "•  All tools are free/open-source — zero licensing costs",
    "•  Web app deploys instantly via Firebase Hosting",
]
add_bullet_slide(slide, Inches(1), Inches(2.4), Inches(5.3), Inches(4.5),
                 feasibility, font_size=14, color=LIGHT_GRAY, spacing=Pt(10))

# Innovation column
add_shape_bg(slide, Inches(6.8), Inches(1.7), Inches(5.7), Inches(0.55), PRIMARY)
add_text_box(slide, Inches(6.8), Inches(1.75), Inches(5.7), Inches(0.5),
             "💡  Innovation", font_size=17, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

innovation = [
    "•  No existing platform for student-to-student skill bartering in SA",
    "•  Credit-based economy incentivizes teaching — not just learning",
    "•  Smart matching algorithm with reciprocal skill detection",
    "•  Cross-platform: Android + Web sharing a single real-time backend",
    "•  Multi-university support — breaks institutional silos",
    "•  Integrated video calls directly within the platform",
]
add_bullet_slide(slide, Inches(7), Inches(2.4), Inches(5.3), Inches(4.5),
                 innovation, font_size=14, color=LIGHT_GRAY, spacing=Pt(10))


# ═══════════════════════════════════════════════════════════════════
# SLIDE 17 — Potential Impact  (Rubric: Potential Impact)
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
section_header(slide, "Potential Impact", "How EduSwap can transform student learning")

impacts = [
    ("📚", "Reduce Learning Costs", "Students access free tutoring through skill exchange — breaking financial barriers to education"),
    ("🤝", "Build Community", "Creates cross-disciplinary and cross-university connections that wouldn't happen otherwise"),
    ("💼", "Develop Soft Skills", "Teaching builds communication, leadership, and presentation skills valued by employers"),
    ("📈", "Scalable Model", "Can expand to any university in South Africa — and eventually internationally"),
]

y = Inches(1.8)
for icon, title, desc in impacts:
    add_shape_bg(slide, Inches(1), y, Inches(11.3), Inches(1.1), RGBColor(0x1E, 0x1E, 0x30))
    add_text_box(slide, Inches(1.3), y + Inches(0.15), Inches(0.6), Inches(0.6),
                 icon, font_size=28, color=WHITE)
    add_text_box(slide, Inches(2.2), y + Inches(0.1), Inches(9.5), Inches(0.4),
                 title, font_size=17, color=WHITE, bold=True)
    add_text_box(slide, Inches(2.2), y + Inches(0.55), Inches(9.5), Inches(0.4),
                 desc, font_size=13, color=GRAY)
    y += Inches(1.3)

# Bottom stat
add_shape_bg(slide, Inches(1), Inches(6.3), Inches(11.3), Inches(0.7), PRIMARY)
add_text_box(slide, Inches(1.3), Inches(6.35), Inches(10.7), Inches(0.6),
             "\"Education is the most powerful weapon which you can use to change the world.\" — Nelson Mandela",
             font_size=15, color=WHITE, bold=False, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SLIDE 18 — Thank You / Q&A
# ═══════════════════════════════════════════════════════════════════
slide = prs.slides.add_slide(prs.slide_layouts[6])
add_gradient_bg(slide)

add_shape_bg(slide, Inches(0), Inches(0), SLIDE_WIDTH, Inches(0.08), PRIMARY)
add_shape_bg(slide, Inches(0), Inches(7.42), SLIDE_WIDTH, Inches(0.08), PRIMARY)

add_logo(slide, Inches(5.67), Inches(1.5), width=Inches(2))

add_text_box(slide, Inches(1), Inches(3.5), Inches(11.3), Inches(1),
             "Thank You!", font_size=52, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

add_text_box(slide, Inches(1), Inches(4.6), Inches(11.3), Inches(0.5),
             "Questions & Discussion", font_size=24, color=LIGHT_GRAY, alignment=PP_ALIGN.CENTER)

add_shape_bg(slide, Inches(4.9), Inches(5.5), Inches(3.5), Inches(0.5), PRIMARY)
add_text_box(slide, Inches(4.9), Inches(5.5), Inches(3.5), Inches(0.5),
             "EduSwap — Phase 1", font_size=16, color=WHITE, bold=True, alignment=PP_ALIGN.CENTER)

add_text_box(slide, Inches(1), Inches(6.3), Inches(11.3), Inches(0.4),
             "BICT300 • Final Year Project • April 2026",
             font_size=13, color=GRAY, alignment=PP_ALIGN.CENTER)


# ═══════════════════════════════════════════════════════════════════
# SAVE
# ═══════════════════════════════════════════════════════════════════
output_path = os.path.join(os.path.dirname(__file__), "EduSwap_Phase1_Presentation.pptx")
prs.save(output_path)
print(f"Presentation saved to: {output_path}")
print(f"   Slides: {len(prs.slides)}")
