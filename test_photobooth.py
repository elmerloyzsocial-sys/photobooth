#!/usr/bin/env python3
"""
Test script to verify the photobooth application files are properly structured
and contain the required modifications.
"""

import os
import re

def test_html_structure():
    """Test that HTML file has proper structure"""
    print("Testing HTML structure...")
    
    with open('./final/index.html', 'r') as f:
        html_content = f.read()
    
    # Check for required elements
    required_elements = [
        'instax-frame',
        'camera-feed',
        'photo-canvas',
        'captured-photo',
        'countdown-overlay',
        'control-panel',
        'take-photo',
        'switch-camera',
        'print-photo',
        'share-photo'
    ]
    
    for element in required_elements:
        if element in html_content:
            print(f"✓ Found {element}")
        else:
            print(f"✗ Missing {element}")
    
    print("HTML structure test completed.\n")

def test_css_modifications():
    """Test that CSS has the required modifications"""
    print("Testing CSS modifications...")
    
    with open('./final/css/styles.css', 'r') as f:
        css_content = f.read()
    
    # Check for button positioning improvements
    if 'justify-content: center' in css_content and 'height: 100%' in css_content:
        print("✓ Button positioning improvements found")
    else:
        print("✗ Button positioning improvements missing")
    
    # Check for 4:3 aspect ratio
    if 'aspect-ratio: 4/3' in css_content:
        print("✓ 4:3 aspect ratio specified")
    else:
        print("✗ 4:3 aspect ratio missing")
    
    # Check for Instax frame styling
    if 'instax-frame' in css_content:
        print("✓ Instax frame styling found")
    else:
        print("✗ Instax frame styling missing")
    
    print("CSS modifications test completed.\n")

def test_js_modifications():
    """Test that JavaScript has the required modifications"""
    print("Testing JavaScript modifications...")
    
    with open('./final/js/photobooth.js', 'r') as f:
        js_content = f.read()
    
    # Check for frame capture functionality
    if 'addInstaxFrameStyling' in js_content:
        print("✓ Instax frame styling function found")
    else:
        print("✗ Instax frame styling function missing")
    
    # Check for 4:3 aspect ratio implementation
    if 'aspectRatio = 4 / 3' in js_content:
        print("✓ 4:3 aspect ratio implementation found")
    else:
        print("✗ 4:3 aspect ratio implementation missing")
    
    # Check for canvas-based photo capture
    if 'frameWidth = 800' in js_content and 'frameHeight = frameWidth / aspectRatio' in js_content:
        print("✓ Canvas-based photo capture with proper dimensions found")
    else:
        print("✗ Canvas-based photo capture with proper dimensions missing")
    
    # Check for INSTAX branding
    if 'INSTAX' in js_content and 'fillText' in js_content:
        print("✓ INSTAX branding implementation found")
    else:
        print("✗ INSTAX branding implementation missing")
    
    print("JavaScript modifications test completed.\n")

def test_file_integrity():
    """Test that all required files exist"""
    print("Testing file integrity...")
    
    required_files = [
        './final/index.html',
        './final/css/styles.css',
        './final/js/photobooth.js'
    ]
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✓ {file_path} exists")
        else:
            print(f"✗ {file_path} missing")
    
    print("File integrity test completed.\n")

def main():
    """Run all tests"""
    print("=== Photobooth Application Test Suite ===\n")
    
    test_file_integrity()
    test_html_structure()
    test_css_modifications()
    test_js_modifications()
    
    print("=== Test Suite Completed ===")

if __name__ == "__main__":
    main()