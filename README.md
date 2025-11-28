# StitchCraft

A precision manual image stitching tool built with React and TypeScript. Upload multiple images, arrange them with drag-and-drop, adjust rotation and opacity, and export the exact coordinate data.

## Features

- **Multi-Image Upload**: Upload and manage multiple images simultaneously
- **Drag & Drop Interface**: Intuitively position images on the canvas
- **Layer Management**: Organize images in layers with full control
- **Precision Controls**:
  - Adjustable rotation with visual feedback
  - Opacity control for perfect alignment
  - Scale/zoom capabilities
  - Fine-tuned coordinate positioning
- **Export Functionality**: Export precise coordinate data and layer information
- **Modern UI**: Clean, responsive interface with frosted glass design

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** or **yarn**

For Docker deployment:
- **Docker**
- **Make** (optional, for simplified commands)

## Installation

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd stitch-image
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## Docker Deployment

### Using Docker directly

1. **Build the Docker image**:
   ```bash
   docker build -t stitchcraft .
   ```

2. **Run the container**:
   ```bash
   docker run -p 5173:5173 stitchcraft
   ```

3. **Access the app** at `http://localhost:5173`

### Using Makefile (Recommended)

We provide a Makefile for simplified Docker operations:

```bash
# Build the Docker image
make build

# Run the container
make run

# Stop the container
make stop

# View logs
make logs

# Clean up containers and images
make clean

# Rebuild and run (useful during development)
make rebuild
```

## Available Scripts

- **`npm run dev`** - Start development server
- **`npm run build`** - Build for production
- **`npm run preview`** - Preview production build locally

## Project Structure

```
stitch-image/
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
├── types.ts             # TypeScript type definitions
├── components/          # Reusable UI components
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
├── Dockerfile           # Docker configuration
├── Makefile             # Build automation
└── README.md            # This file
```

## Usage

1. **Upload Images**: Click the upload button or drag images into the app
2. **Arrange Images**: Drag images to position them on the canvas
3. **Adjust Properties**: Use the controls panel to adjust:
   - Position (X, Y coordinates)
   - Rotation angle
   - Scale/size
   - Opacity for alignment
4. **Layer Management**: Reorder layers to control which images appear on top
5. **Export Data**: Export the final coordinate and layer data for your stitched composition

## Development

### Hot Module Replacement

The development server supports HMR for instant updates during development.

### Type Checking

```bash
npx tsc --noEmit
```

## Building for Production

```bash
npm run build
```

The production build will be output to the `dist/` directory.

## License

This project is private and not licensed for public use.

## Contributing

This is a private project. For internal contributions, please follow the established code style and submit pull requests for review.
