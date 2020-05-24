require_relative 'complex_number'

puts 'Initize number to 0 + 0i, magnitude = 0.'

x = ComplexNumber.new

if x.a == 0
  puts 'pass'
else
  puts 'fail. Real Component is not 0'
end

if x.b == 0
  puts 'pass'
else
  puts 'fail. Nonreal Component is not 0'
end

if x.magnitude == 0
  puts 'pass'
else
  puts 'fail. Magnitude is not 0'
end


puts 'Initialize number: 3 + 4i, magnitude = 5'

x = ComplexNumber.new(3, 4)

if x.a == 3
  puts 'pass'
else
  puts 'fail. Real Component is not 0'
end

if x.b == 4
  puts 'pass'
else
  puts 'fail. Nonreal Component is not 0'
end

if x.magnitude == 5
  puts 'pass'
else
  puts 'fail. Magnitude is not 0'
end


puts 'Initialize number: 3 + 4i, calculate(3 + 4i)^2 = -7 + 24i, magnitude = 25'

x = ComplexNumber.new(3, 4)
y = x**2

if y.a == -7
  puts 'pass'
else
  puts 'fail. Real Component is not -7'
end

if y.b == 24
  puts 'pass'
else
  puts 'fail. Nonreal Component is not 24'
end

if y.magnitude == 25
  puts 'pass'
else
  puts 'fail. Magnitude is not 25'
end


puts 'Initialize number 1 + 0i, iterates trend to infinity, not part of the Mandelbrot Set'

x = ComplexNumber.new(1, 0)
unless x.member? == true
  puts 'pass'
else
  puts 'fail. 1 should not be part of the Mandelbrot Set'
  puts "iterations = #{x.member?}"
end



puts 'Member function should return number of iterations to reach 2 if not member of set.'

x = ComplexNumber.new(0,0)
if x.member? === true
  puts 'pass'
else
  puts 'fail. 0 + 0i should return true, iterates will never exceed 2'
end

