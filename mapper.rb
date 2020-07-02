require_relative 'mandelbrot_factory'
require 'fileutils'

class Mapper

end


def purge_folder(path)
  FileUtils.rm_f Dir.glob("#{path}/*")
end


folder = 'renders/cusp'

resolutions = Renderer::RESOLUTIONS[17..17]
cusp = CuspFactory.new resolutions, export_location: folder
cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
cusp.map.load
cusp.precisions = 35
cusp.center = [0.2550505158, -0.00064763438]
cusp.iterations = 16000

[1.5].each do |color_speed|
  cusp.run color_speed: color_speed
end
cusp.map.write overwrite: true


