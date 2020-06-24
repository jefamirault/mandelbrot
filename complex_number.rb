require 'bigdecimal'

class ComplexNumber
  attr_accessor :real_component, :nonreal_component
  
  alias_method :a, :real_component
  alias_method :b, :nonreal_component

  def initialize(*args)
    # if args.size == 1
    #   self.real_component = BigDecimal(args[:real_component])
    #   self.nonreal_component = BigDecimal(args[:nonreal_component])
    # else
    #   self.real_component = BigDecimal(args[0])
    #   self.nonreal_component = BigDecimal(args[1])
    # end
    if args.size == 1
      self.real_component =  args[:real_component]
      self.nonreal_component = args[:nonreal_component]
    elsif args.size == 0
      self.real_component = 0
      self.nonreal_component = 0
    else
      self.real_component = args[0]
      self.nonreal_component = args[1]
    end
  end

  def magnitude
    (self.real_component**2 + self.nonreal_component**2)**0.5
  end

  def +(complex_number)
    ComplexNumber.new(self.a + complex_number.a, self.b + complex_number.b)
  end

  def **(exponent = 2) #TODO exponent > 2 ; use tail recursion!
    ComplexNumber.new(a**2 - b**2, 2*a*b)
  end

  def ==(complex_number)
    a == complex_number.a && b == complex_number.b
  end

  def z(iteration = 2)
    if iteration == 1
      # 0^2 + c
      self
    else # z2 = z1^2 + c
      z(iteration - 1) ** 2 + self
    end
  end

  # behavior of c (self) under iteration of fc(z) = z^2 + c
  def member?(iterations = 40)
    z = self
    if z.magnitude >= 2
      return 0
    end
    iterations.times do |i|
      z = z**2 + self
      if z.magnitude >= 2
        return i + 1
      end
    end
    true
  end

  def to_s
    if b > 0
      "#{a} + #{b}i"
    elsif b ==0
      "#{a}"
    else
      "#{a} - #{-b}i"
    end
  end
end

def ComplexNumber(a,b)
  ComplexNumber.new(a,b)
end
