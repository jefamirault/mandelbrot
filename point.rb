class Point
  attr_accessor :real, :imaginary, :iterates_under_two, :iterations_explored

  def initialize(real, imaginary, iterates_under_two, iterations_explored)
    @real = real
    @imaginary = imaginary
    @iterates_under_two = iterates_under_two
    @iterations_explored = iterations_explored
  end
end