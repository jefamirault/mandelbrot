require 'bigdecimal'
class Mandelbrot
  attr_accessor :number, :max_iterations, :escape_radius

  def initialize(number, iterations = 20)
    @number = number
    @max_iterations = iterations
    @escape_radius = 3.1
  end

  def bounded_iterates(precision = 3)
    z = @number
    iteration = 0
    while z.magnitude < @escape_radius && iteration <= @max_iterations
      z = z**2 + @number
      iteration += 1
    end
    if z.magnitude < @escape_radius
      @max_iterations
    else
      3.times do
        z = z**2 + @number
        iteration += 1
      end
      mu = iteration - Math.log(Math.log(z.magnitude)) / Math.log(2)
      mu.round(precision)
    end
  end

  def iteration_z(z)
    if z == 1
      @number
    else
      iteration_z(z - 1) ** 2 + @number
    end
  end

  def member?
    bounded_iterates == @max_iterations
  end

  def verbose
    puts "The number #{@number} has #{iterates_under_two} iterates with magnitude less than two out of #{@max_iterations} explored."
    if member?
      puts "#{@number} meets the criteria for set membership at #{@max_iterations} iterations."
    else
      puts "The size of the iterates of #{@number} trend to infinity. It is not a member of the Mandelbrot Set."
    end
  end
end