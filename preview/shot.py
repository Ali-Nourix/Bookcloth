import sys
from playwright.sync_api import sync_playwright
mode = sys.argv[1] if len(sys.argv)>1 else 'light'
out  = sys.argv[2] if len(sys.argv)>2 else f'shot-{mode}.png'
page_url = 'file:///home/claude/preview/' + (sys.argv[3] if len(sys.argv)>3 else 'index.html')
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width':1440,'height':900}, device_scale_factor=2)
    pg.goto(page_url)
    pg.evaluate(f"document.body.className = document.body.className.replace(/theme-\\w+/, 'theme-{mode}')")
    pg.wait_for_timeout(600)
    pg.screenshot(path=out)
    b.close()
print('wrote', out)
