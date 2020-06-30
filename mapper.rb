require_relative 'mandelbrot_factory'
require 'fileutils'

class Mapper

end


def purge_folder(path)
  FileUtils.rm_f Dir.glob("#{path}/*")
end


folder = 'renders/test/cusp'
# purge_folder folder

resolutions = Renderer::RESOLUTIONS[13..16]
cusp = CuspFactory.new resolutions, export_location: folder
cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile.json"
cusp.map.load
cusp.precisions = (30..33)
cusp.center = [0.2550505158, -0.00064763438]
cusp.iterations = 8000

[0.125, 0.25, 0.5, 1].each do |color_speed|
  cusp.run color_speed: color_speed
end

cusp.map.write overwrite: true

