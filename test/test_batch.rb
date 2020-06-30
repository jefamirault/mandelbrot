require 'simple_test'
require_relative 'grid_test'
require_relative 'complex_number_test'
require_relative 'mandelbrot_test'

class TestBatch

end


tests = [GridTest, ComplexNumberTest, MandelbrotTest]

SimpleTest.batch(tests)
