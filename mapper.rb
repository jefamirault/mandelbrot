require_relative 'mandelbrot_factory'
require 'fileutils'

class Mapper

end


def purge_folder(path)
  FileUtils.rm_f Dir.glob("#{path}/*")
end


folder = 'renders/cusp'

# resolutions = Renderer::RESOLUTIONS[18]
# resolutions = Renderer::RESOLUTIONS[17..17]
# resolutions = Renderer::RESOLUTIONS[11..11]
resolutions = Renderer::RESOLUTIONS[8..8]
cusp = CuspFactory.new resolutions, export_location: folder
cusp.map = MandelbrotMap.new mapfile: "#{folder}/mapfile"
cusp.map.load
cusp.precisions = (38..40)
cusp.center = [0.25505051597, -0.000647633368]
cusp.iterations = 16000

[0.75].each do |color_speed|
  cusp.run color_speed: color_speed
end
cusp.map.write overwrite: true
