# 📿 ChatGPT Prompt: Extract Kitab Firasat Data

## Instructions for Neo Todak

1. Open ChatGPT (GPT-4 with vision)
2. Upload the PDF: `/Users/broneotodak/Downloads/Kitab firasat.pdf`
3. Copy and paste the prompt below
4. Save the JSON output to: `/Users/broneotodak/Projects/Firasah/firasah-ai/kitab-firasat-rules.json`

---

## 🔮 PROMPT TO USE:

```
I have uploaded a classical Islamic text called "Kitab Firasat" (Book of Physiognomy). This book contains wisdom about reading human character and personality traits from facial features.

I need you to extract ALL the facial feature interpretations and create a structured JSON file for my web application (Firasah AI).

## Please extract information for these 10 facial features:

1. **FOREHEAD (Jabhah / الجبهة)**
2. **EYEBROWS (Al-Hawajib / الحواجب)**
3. **EYES (Al-'Aynayn / العينين)**
4. **NOSE (Al-Anf / الأنف)**
5. **LIPS & MOUTH (Al-Fam / الفم)**
6. **JAWLINE & CHIN (Al-Diqn / الذقن)**
7. **CHEEKBONES (Al-Khadd / الخد)**
8. **EARS (Al-Udzun / الأذن)**
9. **FACE SHAPE (Wajh / الوجه)**
10. **HAIRLINE (Sha'r / الشعر)**

## For EACH feature, extract:
- Physical variations (e.g., "broad forehead", "narrow forehead", "high forehead")
- Character/personality traits associated with each variation
- Any quotes or references from the original text
- Arabic terms if mentioned

## Output Format (JSON):

```json
{
  "source": "Kitab Firasat",
  "language": "Malay/Arabic",
  "features": {
    "forehead": {
      "arabic": "الجبهة",
      "malay": "Dahi",
      "variations": [
        {
          "physical": "Broad/Wide forehead",
          "physical_malay": "Dahi luas",
          "traits": ["Wisdom", "Intelligence", "Deep thinking"],
          "traits_malay": ["Kebijaksanaan", "Kecerdasan", "Pemikiran mendalam"],
          "quote": "Original quote from the book if available",
          "interpretation": "Detailed interpretation in formal Malay"
        },
        {
          "physical": "Narrow forehead",
          "physical_malay": "Dahi sempit",
          "traits": ["..."],
          "traits_malay": ["..."],
          "quote": "...",
          "interpretation": "..."
        }
      ]
    },
    "eyebrows": {
      "arabic": "الحواجب",
      "malay": "Kening",
      "variations": [...]
    },
    "eyes": {...},
    "nose": {...},
    "lips_mouth": {...},
    "jawline_chin": {...},
    "cheekbones": {...},
    "ears": {...},
    "face_shape": {...},
    "hairline": {...}
  },
  "general_principles": [
    "Any general wisdom about firasah from the book"
  ],
  "warnings": [
    "Any cautions mentioned about interpreting faces"
  ]
}
```

## Important Notes:
- Use formal, respectful Bahasa Melayu (classical style)
- Include Arabic terms where available
- If something is not in the book, indicate "Not specified in source"
- Maintain the scholarly tone of the original text
- Include positive AND negative trait interpretations
- Be comprehensive - extract every facial interpretation you can find

Please go through the entire PDF and extract all relevant physiognomy information.
```

---

## After Getting the JSON:

1. Save it as `kitab-firasat-rules.json` in the project folder
2. Let ClaudeN know so we can create the OpenAI interpretation function
3. The function will use this JSON to provide Kitab Firasat-based interpretations

---

## PDF Location:
```
/Users/broneotodak/Downloads/Kitab firasat.pdf
```

Size: 22.87 MB (likely scanned images - ChatGPT vision can read it)
