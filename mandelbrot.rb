class Mandelbrot
  attr_accessor :number, :iterations

  def initialize(number, iterations = 20)
    @number = number
    @iterations = iterations
  end

  def iterates_under_two
    z = @number
    if z.magnitude >= 2
      return 0
    end
    @iterations.times do |i|
      z = z**2 + @number
      if z.magnitude >= 2
        return i + 1
      end
    end
    @iterations
  end

  def member?
    iterates_under_two == iterations
  end
end