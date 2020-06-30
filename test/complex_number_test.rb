require 'simple_test'

class ComplexNumberTest < SimpleTest
  def run
    t0 = Time.now
    puts "\nRunning #{self.class}.rb...".cyan
    test_case 'Initialize Complex Number to (0, 0)' do
      @complex = Complex(0, 0)

      test 'Real Component should be 0' do
        assert_equal @complex.real, 0
      end

      test 'Imaginary Component should be 0' do
        assert_equal @complex.imaginary, 0
      end

      test 'Magnitude should be 0' do
        assert_equal @complex.magnitude, 0
      end
    end

    test_case 'Initialize Complex Number: 3 + 4i' do
      @complex = Complex(3,4)

      test 'Real Component should be 3' do
        assert_equal @complex.real, 3
      end

      test 'Imaginary Component should be 4' do
        assert_equal @complex.imaginary, 4
      end

      test 'Magnitude should be 5' do
        assert_equal @complex.magnitude, 5
      end
    end

    test_case 'Calculate the square of 3 + 4i' do
      @complex = Complex(3,4)

      test '(3 + 4i)^2 should equal (==) -7 + 24i' do
        assert_equal @complex ** 2, Complex(-7,24)
      end
      test 'The magnitude should be 25' do
        assert_equal (@complex ** 2).magnitude, 25
      end
    end

    t1 = Time.now
    @benchmark = t1 - t0
  end

end

# test = ComplexNumberTest.new
# test.run
# test.result
