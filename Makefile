VERSION := $(shell python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
ZIP_NAME := scfs-chrome-v$(VERSION).zip
DIST_FILES := manifest.json content.js styles.css

.PHONY: zip tag release clean

zip: $(ZIP_NAME)

$(ZIP_NAME): $(DIST_FILES)
	@rm -f $(ZIP_NAME)
	zip $(ZIP_NAME) $(DIST_FILES)
	@echo "Built $(ZIP_NAME)"

tag:
	git tag -a "v$(VERSION)" -m "v$(VERSION)"
	git push origin "v$(VERSION)"

release: zip tag

clean:
	rm -f scfs-chrome-v*.zip
