# Mandelbrot

Visualize the Mandelbrot Set with a set of computing, mapping, and rendering tools.

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

### Tests

Use `cd mandelbrot` to navigate to the project directory.
Run tests:
```
 ruby test/test_batch.rb
```

and then:  

```
ruby test/render_test.rb
```
Look in the folder `renders/test` and visually inspect output.

## Platform & Dependencies

### Operating System
Developed on Windows 10. Batch rendering done on Ubuntu 18.04 instances in VirtualBox.

### Gems

* Simple Test - Test Framework
* [colorize](https://github.com/fazibear/colorize) - Colorful console output in Windows
* [ChunkyPNG/OilyPNG](https://github.com/wvanbergen/chunky_png) - Output .png images

## Usage


## Mandelbrot.rb

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

### Testing

#### Unit Tests:
Run all unit tests with:

`ruby test/test_batch.rb`

Or run individually:

```ruby
ruby test/complex_number_test.rb
ruby test/mandelbrot_test.rb
ruby test/grid_test.rb
```

Render Tests:

`ruby test/render_test.rb`

Rendering is a time-consuming process. Use options = {fast: true} for quicker tests, or options = {slow: true} for more in-depth tests.

```ruby
ruby test/render_test.rb fast
# fast tests
ruby test/render_test.rb
# regular tests
ruby test/render_test.rb slow
# more comprehensive, slower tests
```