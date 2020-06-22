require_relative 'complex_number'
require 'colorize'
require 'byebug'

puts "COMPLEX NUMBER TESTS"
puts 'Initialize number to 0 + 0i, magnitude = 0.'

def pass(message = 'pass')
  puts message.green
end

def fail(message)
  puts message.on_red
end

x = ComplexNumber.new
if x.a == 0
  pass
else
  fail 'Real Component is not 0'
end

if x.b == 0
  pass
else
  fail 'Nonreal Component is not 0'
end

if x.magnitude == 0
  pass
else
  fail 'Magnitude is not 0'
end


puts 'Initialize number: 3 + 4i, magnitude = 5'

x = ComplexNumber.new(3, 4)

if x.a == 3
  pass
else
  fail 'Real Component is not 0'
end

if x.b == 4
  pass
else
  fail 'Nonreal Component is not 0'
end

if x.magnitude == 5
  pass
else
  fail 'Magnitude is not 0'
end


puts 'Initialize number: 3 + 4i, calculate(3 + 4i)^2 = -7 + 24i, magnitude = 25'

x = ComplexNumber.new(3, 4)
y = x**2

if y.a == -7
  pass
else
  fail 'Real Component is not -7'
end

if y.b == 24
  pass
else
  fail 'Nonreal Component is not 24'
end

if y.magnitude == 25
  pass
else
  fail 'Magnitude is not 25'
end


puts 'Initialize number 1 + 0i, iterates trend to infinity, not part of the Mandelbrot Set'

x = ComplexNumber.new(1, 0)

unless x.member? === true
  pass
else
  fail 'fail. 1 should not be part of the Mandelbrot Set'
  puts "iterations = #{x.member?}"
end



puts 'Member function should return number of iterations to reach 2 if not member of set.'

x = ComplexNumber.new(0,0)
if x.member? === true
  pass
else
  fail 'fail. 0 + 0i should return true, iterates will never exceed 2'
end


require_relative 'grid'

puts 'GRID TESTS'

puts 'Initialize 16x9 grid centered at (0, 0)'

grid = Grid.new(0, 0, 2, 16, 9)

puts '(0, 0) should be present in the grid'

if grid.include?(0,0)
  pass
else
  fail '(0, 0) is not present on grid centered at (0, 0)'
end


puts 'Step should be 0.25'

if grid.step == 0.25
  pass
else
  fail 'step is not 0.25'
end



puts 'Top Left Corner should be (-2, 1)'

if grid.x_min == -2
  pass
else
  fail "x lower bound is not -2; returned #{grid.x_min}"
end

if grid.y_max == 1
  pass
else
  fail "y upper bound is not 1; returned #{grid.y_max}"
end




puts 'Bottom Right Corner should be (1.75, -1)'

if grid.x_max == 1.75
  pass
else
  fail "fail. x upper bound is not 1.75; returned #{grid.x_max}"
end

if grid.y_max == 1
  pass
else
  fail 'fail. y lower bound is not -1'
end
