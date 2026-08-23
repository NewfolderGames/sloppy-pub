import re
import sys

target_file = sys.argv[1] if len(sys.argv) > 1 else "DOCUMENTATION.md"

with open(target_file, "r") as f:
    lines = f.readlines()

in_code = False
non_code_lines = []

for idx, line in enumerate(lines, 1):
    if line.strip().startswith("```"):
        in_code = not in_code
        continue
    if not in_code:
        non_code_lines.append((idx, line))

patterns = [
    (r"\b(?:it's|don't|can't|won't|shouldn't|hasn't|haven't|hadn't|isn't|aren't|wasn't|weren't|they're|we're|you're|I'm|I've|you've|we've|they've|I'll|you'll|he'll|she'll|we'll|they'll)\b", "Contraction"),
    (r"\b(?:has been|have been|had been)\b", "Perfect passive"),
    (r"\b(?:should|would|may|might|could)\b", "Unapproved modal"),
    (r",\s*(?:making|allowing|enabling|ensuring)\b", "-ing verb clause"),
    (r";", "Semicolon"),
    (r"\b(?:e\.g\.|i\.e\.|etc\.)\b", "Latin abbreviation"),
    (r"\b(?:simply|easily|seamlessly|robust|leverage|utilize)\b", "AI slop / filler"),
]

found = 0
for idx, line in non_code_lines:
    for pat, name in patterns:
        m = re.search(pat, line, re.IGNORECASE)
        if m:
            print(f"Line {idx}: [{name}] {m.group(0)} -> {line.strip()}")
            found += 1

print(f"Total issues found outside code blocks: {found}")

# Check sentence length outside code blocks
# Sentence split on . ! ? followed by space or newline
text_outside = "".join(line for _, line in non_code_lines)
# Remove markdown headers and list bullets
clean_lines = []
for line in text_outside.split("\n"):
    stripped = line.strip()
    if stripped.startswith("#") or stripped.startswith("---") or stripped.startswith("|"):
        continue
    if stripped.startswith("- "):
        stripped = stripped[2:]
    clean_lines.append(stripped)

clean_text = " ".join(clean_lines)
sentences = re.split(r"(?<=[.!?])\s+", clean_text)
long_sentences = []
for s in sentences:
    words = [w for w in s.split() if w]
    if len(words) > 25:
        long_sentences.append((len(words), s))

print(f"Long sentences (> 25 words): {len(long_sentences)}")
for count, s in long_sentences:
    print(f"[{count} words] {s}")
