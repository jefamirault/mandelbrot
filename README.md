# Mandelbrot

Visualize the Mandelbrot Set with a series of computing, mapping, and rendering tools.

## Getting Started

### Environment Setup

Confirm you have [Ruby](https://www.ruby-lang.org/en/documentation/installation/) installed by running `ruby -v` . Using Ruby 2.6.6 at the time this was written.
```
ruby 2.6.6p146 (2020-03-31 revision 67876) [x64-mingw32]
```

Clone the repository using `git clone https://github.com/jefamirault/mandelbrot.git`
```
Cloning into 'mandelbrot'...
remote: Enumerating objects: 183, done.
remote: Counting objects: 100% (183/183), done.
remote: Compressing objects: 100% (69/69), done.
Receiving objects: 100% (183/183)used 178 (delta 111), pack-reused 0 eceiving objects:  93% (171/183)
Receiving objects: 100% (183/183), 235.07 KiB | 3.09 MiB/s, done.
Resolving deltas: 100% (116/116), done.
```

### Install Gems
Run `bundle` to install gems from Gemfile
```
Using bundler 1.17.2
Using chunky_png 1.3.11
Using colorize 0.8.1
Using oily_png 1.2.1
Using simple_test 0.1.0 from https://github.com/jefamirault/simple_test.git (at master@524f6e0)
Bundle complete! 3 Gemfile dependencies, 5 gems now installed.
Use `bundle info [gemname]` to see where a bundled gem is installed.
```

### Dependencies

* [Simple Test](https://github.com/jefamirault/simple_test) - Simple Test Framework
* [colorize](https://github.com/fazibear/colorize) - Colorful console output in Windows
* [ChunkyPNG/OilyPNG](https://github.com/wvanbergen/chunky_png) - Output .png images

## Usage

Initialize Mandelbrot object with a complex number and the number of iterations to compute.

```ruby

number_to_test = Complex(0, 0)
iterations = 20
mandelbrot = Mandelbrot.new(number_to_test, iterations)
mandelbrot.member?
#  true
puts mandelbrot.verbose
#  The number 0+0i has 20 iterates with magnitude less than two out of 20 explored.
#  0+0i meets the criteria for set membership at 20 iterations.
```

## Testing

### Windows
Unit Tests:
```
./test
```

Render Tests:

```
./test render
```

### Linux & Mac

Unit Tests:

```
./test.sh
```

Render Tests:

```
./test.sh render
```
