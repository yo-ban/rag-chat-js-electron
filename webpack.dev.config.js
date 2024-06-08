const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

const mainConfig =  {
  mode: 'development', // または 'development'
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  target: 'electron-main',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'faiss-node': 'commonjs faiss-node'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};

const preloadConfig = {
  mode: 'development',
  entry: './src/preload.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'preload.js'
  },
  target: 'electron-preload',
  node: {
    __dirname: false,
    __filename: false,
  },
  externals: {
    'faiss-node': 'commonjs faiss-node'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  }
};

const rendererConfig = {
  mode: 'development',
  entry: './src/renderer.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: path.resolve(__dirname, 'node_modules'),
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  target: 'electron-renderer',
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public/styles', to: 'styles' }, // CSSファイルをコピー
        { from: 'src/locales', to: 'locales' } // localeファイルをコピー
      ]
    })
  ]
};


module.exports = [mainConfig, preloadConfig, rendererConfig]