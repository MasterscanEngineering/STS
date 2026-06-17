with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()
with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()
with open('app.js', 'r', encoding='utf-8') as f:
    js = f.read()

combined = html.replace('<link rel="stylesheet" href="style.css">', f'<style>\n{css}\n</style>')
combined = combined.replace('<script src="app.js"></script>', f'<script>\n{js}\n</script>')

with open('index_combined_final.html', 'w', encoding='utf-8') as f:
    f.write(combined)
print("Merge complete!")
