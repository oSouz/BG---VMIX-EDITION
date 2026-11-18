#!/usr/bin/env bash
# Cross-build of the Windows x64 DLL with MinGW-w64 (Linux/macOS/WSL).
# Needs: x86_64-w64-mingw32-g++, CMake 3.20+, Git and Python 3.
# GLEW 2.1.0 source is in third_party/glew (the SDK only ships an MSVC .lib).
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f ffgl-sdk/source/lib/ffgl/FFGL.cpp ]; then
  git clone https://github.com/resolume/ffgl.git ffgl-sdk
  git -C ffgl-sdk checkout 5b6e07840277df9ec35a228b9eb067636316350f
fi
python3 tools/gen_shader.py
python3 tools/embed_panel.py
cmake -S . -B build-mingw -DCMAKE_SYSTEM_NAME=Windows \
 -DCMAKE_C_COMPILER=x86_64-w64-mingw32-gcc \
 -DCMAKE_CXX_COMPILER=x86_64-w64-mingw32-g++ \
 -DFFGL_ROOT="$PWD/ffgl-sdk" -DBUILD_TESTING=OFF -DCMAKE_BUILD_TYPE=Release
cmake --build build-mingw --parallel 2
echo "Built: build-mingw/BG-STUDIO-SOUZ.dll"
