
import os
import re

def merge_files():
    base_html_path = r'c:\Users\Sabarish\Desktop\monthly Atomization\index_combined.html'
    app_js_path = r'c:\Users\Sabarish\Desktop\monthly Atomization\app.js'
    style_css_path = r'c:\Users\Sabarish\Desktop\monthly Atomization\style.css'
    index_html_path = r'c:\Users\Sabarish\Desktop\monthly Atomization\index.html'
    output_path = r'c:\Users\Sabarish\Desktop\monthly Atomization\index_final.html'

    # Read the files
    with open(base_html_path, 'r', encoding='utf-8') as f:
        base_html = f.read()
    
    with open(app_js_path, 'r', encoding='utf-8') as f:
        app_js = f.read()
    
    with open(style_css_path, 'r', encoding='utf-8') as f:
        style_css = f.read()
        
    with open(index_html_path, 'r', encoding='utf-8') as f:
        index_html = f.read()

    # 1. Update the Header/Actions area in the base HTML with new buttons from index.html (Zoom, Fullscreen)
    # We'll look for the timesheet-actions in index.html
    actions_match = re.search(r'<div class="timesheet-actions">(.*?)</div>', index_html, re.DOTALL)
    if actions_match:
        new_actions = actions_match.group(1).strip()
        # In index_combined.html, find where the buttons are
        # Line 926: <div class="timesheet-actions"> ... </div>
        base_html = re.sub(r'<div class="timesheet-actions">.*?</div>', 
                           f'<div class="timesheet-actions">\n                {new_actions}\n            </div>', 
                           base_html, flags=re.DOTALL)

    # 2. Update the Style section
    # We will replace the entire <style> block in base_html with content from style.css
    # But base_html might have some specific modal styles.
    # Actually style.css should contain everything if it's the master.
    base_html = re.sub(r'<style>.*?</style>', f'<style>\n{style_css}\n    </style>', base_html, flags=re.DOTALL)

    # 3. Update the Script section
    # This is tricky because base_html has Admin logic but app.js has navigation logic.
    # I should attempt to combine them.
    # Let's see if I can just append app.js but resolve conflicts.
    # Better: Replace the script in base_html with app.js content + the missing Admin functions.
    
    # Extract Admin functions from base_html
    admin_funcs = []
    admin_pattern = r'function (handleAdminLogin|toggleAdminLogin|showStatusModal|viewWorkerFromStatus|handleResubmit|showVerifyPanel|hideVerifyPanel|handleVerify|refreshWorkerListFromMaster|loadWorkerList|closeModal).*?\}'
    # Actually, let's just use the whole script from base_html and append the missing navigation/zoom parts from app.js
    
    # Let's extract the script from app.js
    # We want Zoom, Fullscreen, and Keyboard Nav logic.
    nav_zoom_logic = re.search(r'// ===== ZOOM CONTROLS =====.*// ===== KEYBOARD NAVIGATION =====.*?\}\);', app_js, re.DOTALL)
    if nav_zoom_logic:
        logic_to_add = nav_zoom_logic.group(0)
        # Find the end of the script tag in base_html
        base_html = base_html.replace('</script>', f'\n\n        {logic_to_add}\n    </script>')

    # Write the final file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(base_html)
    
    print(f"Successfully merged into {output_path}")

if __name__ == "__main__":
    merge_files()
