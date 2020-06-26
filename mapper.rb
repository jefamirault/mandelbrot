require 'mandelbrot_factory'

class Mapper

end

test_resolutions = [[1920, 1080]]

cusp = CuspFactory.new test_resolutions, export_location: 'renders/cusp', mapfile: 'renders/cusp/mapfile1.json'
cusp.precisions = [24]
cusp.run
