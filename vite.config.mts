import type { UserConfig } from 'vite'; 

export default {
  root: __dirname, 

  build: {
    outDir: 'dist',
    emptyOutDir: true,

    lib: {
      entry: 'src/index.mts',
      fileName: 'index',
      formats: ['es', 'cjs']
    },
    
    rollupOptions: {
      input: 'src/index.mts',
      
      external: [
        'fs/promises',
        'readline/promises',
        'path',
        'url',
        'process'
      ]
    }
  }
} satisfies UserConfig