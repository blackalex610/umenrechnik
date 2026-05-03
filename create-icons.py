"""
Quick Icon Creator for PWA
Creates simple placeholder icons with PIL (Pillow)
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    
    def create_icon(size, filename):
        # Create image with blue background
        img = Image.new('RGB', (size, size), color='#4361ee')
        draw = ImageDraw.Draw(img)
        
        # Draw white circle
        margin = size // 6
        draw.ellipse([margin, margin, size-margin, size-margin], fill='white')
        
        # Draw book emoji or text (simplified)
        font_size = size // 3
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        text = "РЧ"  # Речник abbreviated
        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        position = ((size - text_width) // 2, (size - text_height) // 2 - size//20)
        draw.text(position, text, fill='#4361ee', font=font)
        
        img.save(filename)
        print(f"✅ Created {filename}")
    
    # Create both icon sizes
    create_icon(192, 'icon-192.png')
    create_icon(512, 'icon-512.png')
    
    print("\n🎉 Icons created successfully!")
    print("You can replace them with better designs later.")
    
except ImportError:
    print("❌ PIL/Pillow not installed")
    print("\nInstall it with: pip install Pillow")
    print("Then run this script again.")
    print("\nOR: Just download any image and rename it to icon-192.png and icon-512.png")
